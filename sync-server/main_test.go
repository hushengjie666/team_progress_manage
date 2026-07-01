package main

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/go-sql-driver/mysql"
)

func TestParseCLIConfigPriority(t *testing.T) {
	dir := t.TempDir()
	configPath := filepath.Join(dir, "sync.json")
	if err := os.WriteFile(configPath, []byte(`{
		"addr": "127.0.0.1:9000",
		"mysql_dsn": "config:pass@tcp(127.0.0.1:3306)/timemanage_sync",
		"username": "config-user",
		"password": "config-password",
		"secret": "config-secret"
	}`), 0o600); err != nil {
		t.Fatal(err)
	}
	t.Setenv("TM_SYNC_ADDR", "127.0.0.1:9001")
	t.Setenv("TM_SYNC_USER", "env-user")
	command, cfg, returnedPath, err := parseCLI([]string{"serve", "--config", configPath, "--addr", "127.0.0.1:9002"})
	if err != nil {
		t.Fatal(err)
	}
	if command != "serve" {
		t.Fatalf("command = %q", command)
	}
	if returnedPath != configPath {
		t.Fatalf("config path = %q", returnedPath)
	}
	if cfg.addr != "127.0.0.1:9002" {
		t.Fatalf("addr priority failed: %q", cfg.addr)
	}
	if cfg.username != "env-user" {
		t.Fatalf("env priority failed: %q", cfg.username)
	}
	if cfg.mysqlDSN != "config:pass@tcp(127.0.0.1:3306)/timemanage_sync" {
		t.Fatalf("mysql dsn config failed: %q", cfg.mysqlDSN)
	}
	if cfg.password != "config-password" || cfg.secret != "config-secret" {
		t.Fatalf("config values were not applied: %#v", cfg)
	}
}

func TestParseCLIMigrateSubcommand(t *testing.T) {
	configPath := filepath.Join(t.TempDir(), "sync.json")
	if err := os.WriteFile(configPath, []byte(`{"mysql_dsn":"root:pass@tcp(127.0.0.1:3306)/timemanage_sync"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	command, cfg, returnedPath, err := parseCLI([]string{"migrate", "restore", "--config", configPath, "--to", "202607010001", "--output", "backup.sql", "--input", "backup.sql"})
	if err != nil {
		t.Fatal(err)
	}
	if command != "migrate" {
		t.Fatalf("command = %q", command)
	}
	if returnedPath != configPath {
		t.Fatalf("config path = %q", returnedPath)
	}
	if cfg.migrateAction != "restore" || cfg.migrateTo != "202607010001" || cfg.migrateOutput != "backup.sql" || cfg.migrateInput != "backup.sql" {
		t.Fatalf("migration flags were not parsed: %#v", cfg)
	}
}

func TestHealthHandler(t *testing.T) {
	api := testApp(t)
	recorder := httptest.NewRecorder()
	api.handleHealth(recorder, httptest.NewRequest(http.MethodGet, "/health", nil))
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d", recorder.Code)
	}
	if !strings.Contains(recorder.Body.String(), `"status":"ok"`) {
		t.Fatalf("unexpected body: %s", recorder.Body.String())
	}
}

func TestMySQLStoreRequiresDSN(t *testing.T) {
	db, _, err := openMySQLStore("")
	if err == nil {
		if db != nil {
			_ = db.Close()
		}
		t.Fatal("expected empty mysql dsn to fail")
	}
	if !strings.Contains(err.Error(), "mysql_dsn") {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestMySQLMigrationsApplyVerifyAndBlockDirtyState(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := applyMySQLMigrations(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if err := verifyMySQLMigrations(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	var count int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM schema_migrations WHERE version = '202607010001' AND direction = 'up' AND success = 1`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("successful migration record count = %d", count)
	}

	if err := applyMySQLMigrations(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM schema_migrations WHERE version = '202607010001'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatalf("migration should be idempotent, records = %d", count)
	}

	if _, err := db.ExecContext(
		context.Background(),
		`INSERT INTO schema_migrations (version, name, checksum, direction, applied_at, duration_ms, app_version, success, error_message)
		VALUES ('202607010001', 'initial_mysql_schema', 'bad', 'up', '2026-07-01T00:00:00Z', 1, 'test', 0, 'forced failure')`,
	); err != nil {
		t.Fatal(err)
	}
	if err := applyMySQLMigrations(context.Background(), db); err == nil || !strings.Contains(err.Error(), "dirty") {
		t.Fatalf("expected dirty migration to block apply, got %v", err)
	}
	if _, _, err := openMySQLStore(dsn); err == nil || !strings.Contains(err.Error(), "dirty") {
		t.Fatalf("expected dirty migration to block startup, got %v", err)
	}
}

func TestMySQLMigrationRollbackRequiresDownScript(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := applyMySQLMigrations(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	err = rollbackMySQLMigrations(context.Background(), db, "0")
	if err == nil || !strings.Contains(err.Error(), "no down migration") {
		t.Fatalf("expected irreversible migration rollback to fail, got %v", err)
	}
}

func TestMySQLStoreRoundTrip(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	db, loaded, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	if loaded.NextRevision != 1 || len(loaded.Workspaces) != 0 || len(loaded.Accounts) != 0 {
		t.Fatalf("unexpected empty mysql store: %#v", loaded)
	}

	saved := store{
		Version:      2,
		NextRevision: 9,
		Workspaces: map[string]workspaceData{
			"workspace_mysql": {
				ID:        "workspace_mysql",
				Name:      "MySQL 团队",
				CreatedAt: "2026-06-29T08:00:00Z",
				UpdatedAt: "2026-06-29T09:00:00Z",
				Rows: map[string]syncRow{
					key("project", "project_mysql"): {
						WorkspaceID: "workspace_mysql",
						AccountID:   "account_mysql",
						Entity:      "project",
						ID:          "project_mysql",
						DeviceID:    "device_mysql",
						UpdatedAt:   "2026-06-29T08:30:00Z",
						Version:     1,
						Revision:    3,
						Payload:     json.RawMessage(`{"id":"project_mysql","name":"MySQL 项目"}`),
					},
					key("task", "task_empty_payload"): {
						WorkspaceID: "workspace_mysql",
						AccountID:   "account_mysql",
						Entity:      "task",
						ID:          "task_empty_payload",
						DeviceID:    "device_mysql",
						UpdatedAt:   "2026-06-29T08:40:00Z",
						DeletedAt:   "2026-06-29T08:45:00Z",
						Version:     1,
						Revision:    4,
					},
				},
			},
		},
		Accounts: map[string]accountRecord{
			"account_mysql": {
				ID:           "account_mysql",
				WorkspaceID:  "workspace_mysql",
				Name:         "MySQL 用户",
				Email:        "mysql@example.com",
				PasswordHash: "hash",
				DisabledAt:   "2026-06-29T10:00:00Z",
				CreatedAt:    "2026-06-29T08:00:00Z",
				UpdatedAt:    "2026-06-29T09:00:00Z",
			},
		},
		Users: map[string]userData{},
	}
	if err := saveStoreToMySQL(db, saved); err != nil {
		t.Fatal(err)
	}
	reloaded, err := loadStoreFromMySQL(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if reloaded.NextRevision != saved.NextRevision {
		t.Fatalf("next revision = %d, want %d", reloaded.NextRevision, saved.NextRevision)
	}
	workspace := reloaded.Workspaces["workspace_mysql"]
	if workspace.ID != "workspace_mysql" || workspace.Name != "MySQL 团队" {
		t.Fatalf("workspace round trip failed: %#v", workspace)
	}
	account := reloaded.Accounts["account_mysql"]
	if account.Email != "mysql@example.com" || account.DisabledAt == "" {
		t.Fatalf("account round trip failed: %#v", account)
	}
	project := workspace.Rows[key("project", "project_mysql")]
	if project.AccountID != "account_mysql" || project.Revision != 3 || !json.Valid(project.Payload) {
		t.Fatalf("project row round trip failed: %#v", project)
	}
	task := workspace.Rows[key("task", "task_empty_payload")]
	if task.DeletedAt == "" || string(task.Payload) != "{}" {
		t.Fatalf("empty payload row round trip failed: %#v", task)
	}
}

func TestMigrateFileToMySQL(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	source := filepath.Join(t.TempDir(), "store.json")
	if err := os.WriteFile(source, []byte(`{
		"version": 2,
		"next_revision": 7,
		"workspaces": {
			"workspace_migrate": {
				"id": "workspace_migrate",
				"name": "迁移团队",
				"created_at": "2026-06-29T08:00:00Z",
				"updated_at": "2026-06-29T09:00:00Z",
				"rows": {
					"project/project_migrate": {
						"workspace_id": "workspace_migrate",
						"account_id": "account_migrate",
						"entity": "project",
						"id": "project_migrate",
						"device_id": "device_migrate",
						"updated_at": "2026-06-29T08:30:00Z",
						"version": 1,
						"revision": 3,
						"payload": {"id": "project_migrate", "name": "迁移项目"}
					}
				}
			}
		},
		"accounts": {
			"account_migrate": {
				"id": "account_migrate",
				"workspace_id": "workspace_migrate",
				"name": "迁移用户",
				"email": "migrate@example.com",
				"password_hash": "hash",
				"created_at": "2026-06-29T08:00:00Z",
				"updated_at": "2026-06-29T09:00:00Z"
			}
		}
	}`), 0o600); err != nil {
		t.Fatal(err)
	}

	cfg := defaultConfig()
	cfg.mysqlDSN = dsn
	cfg.migrateSource = source
	if err := runMigrateFile(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}

	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	loaded, err := loadStoreFromMySQL(context.Background(), db)
	if err != nil {
		t.Fatal(err)
	}
	if loaded.NextRevision != 7 {
		t.Fatalf("next revision = %d", loaded.NextRevision)
	}
	if loaded.Workspaces["workspace_migrate"].Name != "迁移团队" {
		t.Fatalf("workspace was not migrated: %#v", loaded.Workspaces)
	}
	if loaded.Accounts["account_migrate"].Email != "migrate@example.com" {
		t.Fatalf("account was not migrated: %#v", loaded.Accounts)
	}
	if loaded.Workspaces["workspace_migrate"].Rows[key("project", "project_migrate")].Revision != 3 {
		t.Fatalf("row was not migrated: %#v", loaded.Workspaces["workspace_migrate"].Rows)
	}

	if err := runMigrateFile(context.Background(), cfg); err == nil || !strings.Contains(err.Error(), "not empty") {
		t.Fatalf("expected non-empty mysql store to be refused, got %v", err)
	}
	cfg.replace = true
	if err := runMigrateFile(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
}

func TestMySQLIncrementalHandlersDoNotDependOnMemoryStore(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	seed := store{
		Version:      2,
		NextRevision: 1,
		Workspaces: map[string]workspaceData{
			"workspace_test": {
				ID:        "workspace_test",
				Name:      "测试团队",
				Rows:      map[string]syncRow{},
				CreatedAt: "2026-05-10T08:00:00Z",
				UpdatedAt: "2026-05-10T08:00:00Z",
			},
		},
		Accounts: map[string]accountRecord{
			"account_owner": {
				ID:           "account_owner",
				WorkspaceID:  "workspace_test",
				Name:         "项目负责人",
				Email:        "owner@example.com",
				PasswordHash: "hash",
				CreatedAt:    "2026-05-10T08:00:00Z",
				UpdatedAt:    "2026-05-10T08:00:00Z",
			},
		},
		Users: map[string]userData{},
	}
	if err := saveStoreToMySQL(db, seed); err != nil {
		t.Fatal(err)
	}
	api := newApp(defaultConfig(), emptyStore(), db)

	pushed := pushRows(t, api, ownerAuth(), "device_mysql", []syncRow{
		{
			Entity:    "project",
			ID:        "project_incremental",
			UpdatedAt: "2026-06-29T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"project_incremental","name":"增量项目","updatedAt":"2026-06-29T09:00:00Z"}`),
		},
	})
	if len(pushed.Accepted) != 1 || pushed.CurrentRevision != 1 {
		t.Fatalf("push response = %#v", pushed)
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	if len(pulled.Changes) != 1 || pulled.Changes[0].ID != "project_incremental" || pulled.CurrentRevision != 1 {
		t.Fatalf("pull response = %#v", pulled)
	}
	revisionRecorder := httptest.NewRecorder()
	api.handleRevision(revisionRecorder, httptest.NewRequest(http.MethodGet, "/sync/revision", nil), ownerAuth())
	var revision revisionResponse
	if err := json.Unmarshal(revisionRecorder.Body.Bytes(), &revision); err != nil {
		t.Fatal(err)
	}
	if revision.CurrentRevision != 1 {
		t.Fatalf("revision = %d", revision.CurrentRevision)
	}
	statusRecorder := httptest.NewRecorder()
	api.handleStatus(statusRecorder, httptest.NewRequest(http.MethodGet, "/sync/status", nil), ownerAuth())
	var status map[string]any
	if err := json.Unmarshal(statusRecorder.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if status["rows"].(float64) != 1 || status["current_revision"].(float64) != 1 {
		t.Fatalf("status = %#v", status)
	}
}

func TestMemoryTeamMemberCanRecreateAfterDisable(t *testing.T) {
	api := testApp(t)

	createBody := []byte(`{"name":"成员","email":"member@example.com","password":"member-secret"}`)
	createRecorder := httptest.NewRecorder()
	api.handleMembers(createRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(createBody)), ownerAuth())
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", createRecorder.Code, createRecorder.Body.String())
	}
	var first memberResponse
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &first); err != nil {
		t.Fatal(err)
	}

	recreateBody := []byte(`{"name":"成员重复","email":"member@example.com","password":"member-secret-2"}`)
	recreateRecorder := httptest.NewRecorder()
	api.handleMembers(recreateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(recreateBody)), ownerAuth())
	if recreateRecorder.Code != http.StatusOK {
		t.Fatalf("recreate active member status = %d, body = %s", recreateRecorder.Code, recreateRecorder.Body.String())
	}
	var updated memberResponse
	if err := json.Unmarshal(recreateRecorder.Body.Bytes(), &updated); err != nil {
		t.Fatal(err)
	}
	if updated.Member.ID != first.Member.ID || updated.Member.DeletedAt != "" {
		t.Fatalf("updated member unexpected: %#v", updated.Member)
	}

	disableBody := bytes.NewReader([]byte(`{"status":"disabled"}`))
	disableRecorder := httptest.NewRecorder()
	api.handleMemberByID(disableRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+first.Member.ID, disableBody), ownerAuth())
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("disable member status = %d, body = %s", disableRecorder.Code, disableRecorder.Body.String())
	}
	disabledLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"member-secret-2","device_id":"device_disabled"}`))
	disabledLoginRecorder := httptest.NewRecorder()
	api.handleLogin(disabledLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", disabledLoginBody))
	if disabledLoginRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("disabled member login status = %d, body = %s", disabledLoginRecorder.Code, disabledLoginRecorder.Body.String())
	}

	recreateRecorder = httptest.NewRecorder()
	api.handleMembers(recreateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(recreateBody)), ownerAuth())
	if recreateRecorder.Code != http.StatusOK {
		t.Fatalf("recreate member status = %d, body = %s", recreateRecorder.Code, recreateRecorder.Body.String())
	}
	var recreated memberResponse
	if err := json.Unmarshal(recreateRecorder.Body.Bytes(), &recreated); err != nil {
		t.Fatal(err)
	}
	if recreated.Member.ID != first.Member.ID || recreated.Member.DeletedAt != "" {
		t.Fatalf("recreated member unexpected: %#v", recreated.Member)
	}
	var payload map[string]any
	if err := json.Unmarshal(recreated.Member.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if status, _ := payload["status"].(string); status != "active" {
		t.Fatalf("recreated member status = %v", status)
	}
	memberLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"member-secret-2","device_id":"device_member"}`))
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", memberLoginBody))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("recreated member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
}

func TestMySQLAuthAndMemberHandlersDoNotDependOnMemoryStore(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginBody := []byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`)
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody)))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}
	if login.Account.Email != "admin" || login.Workspace.Type != "private" {
		t.Fatalf("login response = %#v", login)
	}
	auth := authContext{AccountID: login.Account.ID, WorkspaceID: login.Workspace.ID}

	memberBody := []byte(`{"name":"成员","email":"member@example.com","password":"member-secret"}`)
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(memberBody)), auth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}
	if member.Member.Entity != "team_member" || member.Member.Revision != 1 {
		t.Fatalf("member response = %#v", member)
	}

	pulled := pullRows(t, api, auth, 0)
	if len(pulled.Changes) != 1 || pulled.Changes[0].Entity != "team_member" || pulled.CurrentRevision != 1 {
		t.Fatalf("pull after member create = %#v", pulled)
	}

	if _, err := db.ExecContext(
		context.Background(),
		`UPDATE sync_rows SET deleted_at = ? WHERE workspace_id = ? AND entity = 'team_member' AND entity_id = ?`,
		"2026-07-01T09:00:00Z",
		auth.WorkspaceID,
		member.Member.ID,
	); err != nil {
		t.Fatal(err)
	}
	recreateBody := []byte(`{"name":"成员恢复","email":"member@example.com","password":"restored-secret"}`)
	recreateRecorder := httptest.NewRecorder()
	api.handleMembers(recreateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(recreateBody)), auth)
	if recreateRecorder.Code != http.StatusOK {
		t.Fatalf("recreate member status = %d, body = %s", recreateRecorder.Code, recreateRecorder.Body.String())
	}
	var recreated memberResponse
	if err := json.Unmarshal(recreateRecorder.Body.Bytes(), &recreated); err != nil {
		t.Fatal(err)
	}
	if recreated.Member.ID != member.Member.ID || recreated.Member.DeletedAt != "" {
		t.Fatalf("recreated member was not restored: %#v", recreated.Member)
	}

	memberLoginBody := []byte(`{"email":"member@example.com","password":"restored-secret","device_id":"device_member"}`)
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(memberLoginBody)))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
	var memberLogin loginResponse
	if err := json.Unmarshal(memberLoginRecorder.Body.Bytes(), &memberLogin); err != nil {
		t.Fatal(err)
	}
	regularAuth := authContext{AccountID: memberLogin.Account.ID, WorkspaceID: memberLogin.Workspace.ID}
	deniedBody := bytes.NewReader([]byte(`{"name":"其他成员","email":"other@example.com","password":"other-secret"}`))
	deniedRecorder := httptest.NewRecorder()
	api.handleMembers(deniedRecorder, httptest.NewRequest(http.MethodPost, "/members", deniedBody), regularAuth)
	if deniedRecorder.Code != http.StatusForbidden || !strings.Contains(deniedRecorder.Body.String(), "admin account required") {
		t.Fatalf("expected regular member to be denied, status = %d, body = %s", deniedRecorder.Code, deniedRecorder.Body.String())
	}
}

func TestMySQLTeamMemberCanRecreateAfterDisable(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginBody := []byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`)
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody)))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var owner loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &owner); err != nil {
		t.Fatal(err)
	}
	auth := authContext{AccountID: owner.Account.ID, WorkspaceID: owner.Workspace.ID}

	memberBody := bytes.NewReader([]byte(`{"name":"成员","email":"member@example.com","password":"member-secret"}`))
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", memberBody), auth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}

	disableBody := bytes.NewReader([]byte(`{"status":"disabled"}`))
	disableRecorder := httptest.NewRecorder()
	api.handleMemberByID(disableRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+member.Member.ID, disableBody), auth)
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("disable member status = %d, body = %s", disableRecorder.Code, disableRecorder.Body.String())
	}
	disabledLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"member-secret","device_id":"device_disabled"}`))
	disabledLoginRecorder := httptest.NewRecorder()
	api.handleLogin(disabledLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", disabledLoginBody))
	if disabledLoginRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("disabled member login status = %d, body = %s", disabledLoginRecorder.Code, disabledLoginRecorder.Body.String())
	}

	recreateBody := bytes.NewReader([]byte(`{"name":"成员恢复","email":"member@example.com","password":"restored-secret"}`))
	recreateRecorder := httptest.NewRecorder()
	api.handleMembers(recreateRecorder, httptest.NewRequest(http.MethodPost, "/members", recreateBody), auth)
	if recreateRecorder.Code != http.StatusOK {
		t.Fatalf("recreate member status = %d, body = %s", recreateRecorder.Code, recreateRecorder.Body.String())
	}
	var recreated memberResponse
	if err := json.Unmarshal(recreateRecorder.Body.Bytes(), &recreated); err != nil {
		t.Fatal(err)
	}
	if recreated.Member.ID != member.Member.ID || recreated.Member.DeletedAt != "" {
		t.Fatalf("recreated member unexpected: %#v", recreated.Member)
	}
	var recreatedPayload map[string]any
	if err := json.Unmarshal(recreated.Member.Payload, &recreatedPayload); err != nil {
		t.Fatal(err)
	}
	if status, _ := recreatedPayload["status"].(string); status != "active" {
		t.Fatalf("recreated member status = %v", status)
	}

	memberLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"restored-secret","device_id":"device_member"}`))
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", memberLoginBody))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
}

func TestMySQLTeamMemberRecreateUpdatesActiveWorkspaceMember(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var owner loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &owner); err != nil {
		t.Fatal(err)
	}
	auth := authContext{AccountID: owner.Account.ID, WorkspaceID: owner.Workspace.ID}

	memberBody := []byte(`{"name":"成员","email":"restore@example.com","password":"member-secret"}`)
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(memberBody)), auth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}

	recreateBody := []byte(`{"name":"成员","email":"restore@example.com","password":"restored-secret"}`)
	recreateRecorder := httptest.NewRecorder()
	api.handleMembers(recreateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(recreateBody)), auth)
	if recreateRecorder.Code != http.StatusOK {
		t.Fatalf("recreate active member status = %d, body = %s", recreateRecorder.Code, recreateRecorder.Body.String())
	}
	var recreated memberResponse
	if err := json.Unmarshal(recreateRecorder.Body.Bytes(), &recreated); err != nil {
		t.Fatal(err)
	}
	if recreated.Member.ID != member.Member.ID || recreated.Member.DeletedAt != "" {
		t.Fatalf("recreated member unexpected: %#v", recreated.Member)
	}
	var payload map[string]any
	if err := json.Unmarshal(recreated.Member.Payload, &payload); err != nil {
		t.Fatal(err)
	}
	if status, _ := payload["status"].(string); status != "active" {
		t.Fatalf("recreated member status = %v", status)
	}

	memberLoginBody := bytes.NewReader([]byte(`{"email":"restore@example.com","password":"restored-secret","device_id":"device_member"}`))
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", memberLoginBody))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
}

func TestMySQLStoreSeedsDefaultAdminAccount(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	statusRecorder := httptest.NewRecorder()
	api.handleAuthStatus(statusRecorder, httptest.NewRequest(http.MethodGet, "/auth/status", nil))
	if statusRecorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", statusRecorder.Code, statusRecorder.Body.String())
	}
	var status authStatusResponse
	if err := json.Unmarshal(statusRecorder.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if !status.Bootstrapped || status.WorkspaceID == "" {
		t.Fatalf("auth status = %#v", status)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}
	if login.Account.Email != "admin" || login.Account.Name != "超级管理员" || login.Workspace.Type != "private" {
		t.Fatalf("login = %#v", login)
	}
}

func TestMySQLWorkspaceSwitchingIsolationAndSharedMemberships(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var privateLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &privateLogin); err != nil {
		t.Fatal(err)
	}
	if privateLogin.Workspace.Type != "private" || privateLogin.Membership.Role != "owner" {
		t.Fatalf("private workspace/membership = %#v", privateLogin)
	}
	privateAuth := authContext{AccountID: privateLogin.Account.ID, WorkspaceID: privateLogin.Workspace.ID}

	pushRows(t, api, privateAuth, "device_private", []syncRow{{
		Entity:    "project",
		ID:        "project_private",
		UpdatedAt: "2026-07-01T08:00:00Z",
		Payload:   json.RawMessage(`{"id":"project_private","name":"私人项目","updatedAt":"2026-07-01T08:00:00Z"}`),
	}})

	createSharedBody := bytes.NewReader([]byte(`{"name":"协作一组","device_id":"device_private"}`))
	createSharedRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSharedRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", createSharedBody), privateAuth)
	if createSharedRecorder.Code != http.StatusOK {
		t.Fatalf("create shared status = %d, body = %s", createSharedRecorder.Code, createSharedRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(createSharedRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	if sharedLogin.Workspace.Type != "shared" || len(sharedLogin.Workspaces) < 2 {
		t.Fatalf("shared login response = %#v", sharedLogin)
	}
	sharedAuth := authContext{AccountID: sharedLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	pushRows(t, api, sharedAuth, "device_shared", []syncRow{{
		Entity:    "project",
		ID:        "project_shared",
		UpdatedAt: "2026-07-01T08:10:00Z",
		Payload:   json.RawMessage(`{"id":"project_shared","name":"协作项目","updatedAt":"2026-07-01T08:10:00Z"}`),
	}})

	privateRows := pullRows(t, api, privateAuth, 0)
	if len(privateRows.Changes) != 1 || privateRows.Changes[0].ID != "project_private" {
		t.Fatalf("private workspace rows leaked or missing: %#v", privateRows)
	}
	sharedRows := pullRows(t, api, sharedAuth, 0)
	if len(sharedRows.Changes) != 1 || sharedRows.Changes[0].ID != "project_shared" {
		t.Fatalf("shared workspace rows leaked or missing: %#v", sharedRows)
	}

	switchBody := bytes.NewReader([]byte(`{"workspace_id":"` + privateLogin.Workspace.ID + `","device_id":"device_shared"}`))
	switchRecorder := httptest.NewRecorder()
	api.handleSwitchWorkspace(switchRecorder, httptest.NewRequest(http.MethodPost, "/auth/switch-workspace", switchBody), sharedAuth)
	if switchRecorder.Code != http.StatusOK {
		t.Fatalf("switch status = %d, body = %s", switchRecorder.Code, switchRecorder.Body.String())
	}
	var switched loginResponse
	if err := json.Unmarshal(switchRecorder.Body.Bytes(), &switched); err != nil {
		t.Fatal(err)
	}
	if switched.Workspace.ID != privateLogin.Workspace.ID || switched.Workspace.Type != "private" {
		t.Fatalf("switch response = %#v", switched)
	}

	memberBody := bytes.NewReader([]byte(`{"name":"协作者","email":"member@example.com","password":"member-secret"}`))
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", memberBody), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}

	createSecondBody := bytes.NewReader([]byte(`{"name":"协作二组"}`))
	createSecondRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSecondRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", createSecondBody), sharedAuth)
	if createSecondRecorder.Code != http.StatusOK {
		t.Fatalf("create second shared status = %d, body = %s", createSecondRecorder.Code, createSecondRecorder.Body.String())
	}
	var secondShared loginResponse
	if err := json.Unmarshal(createSecondRecorder.Body.Bytes(), &secondShared); err != nil {
		t.Fatal(err)
	}
	secondSharedAuth := authContext{AccountID: secondShared.Account.ID, WorkspaceID: secondShared.Workspace.ID}

	existingMemberBody := bytes.NewReader([]byte(`{"name":"协作者","email":"member@example.com"}`))
	existingMemberRecorder := httptest.NewRecorder()
	api.handleMembers(existingMemberRecorder, httptest.NewRequest(http.MethodPost, "/members", existingMemberBody), secondSharedAuth)
	if existingMemberRecorder.Code != http.StatusOK {
		t.Fatalf("add existing account status = %d, body = %s", existingMemberRecorder.Code, existingMemberRecorder.Body.String())
	}

	var accountCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM accounts WHERE email = 'member@example.com'`).Scan(&accountCount); err != nil {
		t.Fatal(err)
	}
	if accountCount != 1 {
		t.Fatalf("member account count = %d", accountCount)
	}
	var membershipCount int
	if err := db.QueryRowContext(
		context.Background(),
		`SELECT COUNT(*) FROM workspace_memberships WHERE account_id = ? AND workspace_id IN (?, ?) AND status = 'active'`,
		member.Account.ID,
		sharedLogin.Workspace.ID,
		secondShared.Workspace.ID,
	).Scan(&membershipCount); err != nil {
		t.Fatal(err)
	}
	if membershipCount != 2 {
		t.Fatalf("member active shared memberships = %d", membershipCount)
	}
}

func TestMySQLHTTPHandlersSmoke(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)
	mux := http.NewServeMux()
	mux.HandleFunc("/health", api.handleHealth)
	mux.HandleFunc("/auth/status", api.handleAuthStatus)
	mux.HandleFunc("/auth/bootstrap", api.handleBootstrap)
	mux.HandleFunc("/auth/login", api.handleLogin)
	mux.HandleFunc("/sync/push", api.withAuth(api.handlePush))
	mux.HandleFunc("/sync/pull", api.withAuth(api.handlePull))
	mux.HandleFunc("/sync/revision", api.withAuth(api.handleRevision))
	server := httptest.NewServer(withCORS(mux))
	defer server.Close()

	healthRecorder, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatal(err)
	}
	defer healthRecorder.Body.Close()
	if healthRecorder.StatusCode != http.StatusOK {
		t.Fatalf("health status = %d", healthRecorder.StatusCode)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_http"}`))
	loginHTTPResponse, err := http.Post(server.URL+"/auth/login", "application/json", loginBody)
	if err != nil {
		t.Fatal(err)
	}
	defer loginHTTPResponse.Body.Close()
	if loginHTTPResponse.StatusCode != http.StatusOK {
		t.Fatalf("login status = %d", loginHTTPResponse.StatusCode)
	}
	var login loginResponse
	if err := json.NewDecoder(loginHTTPResponse.Body).Decode(&login); err != nil {
		t.Fatal(err)
	}
	if login.Token == "" {
		t.Fatal("login did not return token")
	}

	pushBody, err := json.Marshal(pushRequest{
		DeviceID: "device_http",
		Changes: []syncRow{
			{
				Entity:    "project",
				ID:        "project_http",
				UpdatedAt: "2026-06-29T09:00:00Z",
				Payload:   json.RawMessage(`{"id":"project_http","name":"HTTP 项目","updatedAt":"2026-06-29T09:00:00Z"}`),
			},
		},
	})
	if err != nil {
		t.Fatal(err)
	}
	pushRequest, err := http.NewRequest(http.MethodPost, server.URL+"/sync/push", bytes.NewReader(pushBody))
	if err != nil {
		t.Fatal(err)
	}
	pushRequest.Header.Set("Content-Type", "application/json")
	pushRequest.Header.Set("Authorization", "Bearer "+login.Token)
	pushResponseHTTP, err := http.DefaultClient.Do(pushRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer pushResponseHTTP.Body.Close()
	if pushResponseHTTP.StatusCode != http.StatusOK {
		t.Fatalf("push status = %d", pushResponseHTTP.StatusCode)
	}
	var pushed pushResponse
	if err := json.NewDecoder(pushResponseHTTP.Body).Decode(&pushed); err != nil {
		t.Fatal(err)
	}
	if len(pushed.Accepted) != 1 || pushed.CurrentRevision != 1 {
		t.Fatalf("push response = %#v", pushed)
	}

	pullRequest, err := http.NewRequest(http.MethodGet, server.URL+"/sync/pull?since=0", nil)
	if err != nil {
		t.Fatal(err)
	}
	pullRequest.Header.Set("Authorization", "Bearer "+login.Token)
	pullResponseHTTP, err := http.DefaultClient.Do(pullRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer pullResponseHTTP.Body.Close()
	if pullResponseHTTP.StatusCode != http.StatusOK {
		t.Fatalf("pull status = %d", pullResponseHTTP.StatusCode)
	}
	var pulled pullResponse
	if err := json.NewDecoder(pullResponseHTTP.Body).Decode(&pulled); err != nil {
		t.Fatal(err)
	}
	if len(pulled.Changes) != 1 || pulled.Changes[0].ID != "project_http" || pulled.CurrentRevision != 1 {
		t.Fatalf("pull response = %#v", pulled)
	}

	revisionRequest, err := http.NewRequest(http.MethodGet, server.URL+"/sync/revision", nil)
	if err != nil {
		t.Fatal(err)
	}
	revisionRequest.Header.Set("Authorization", "Bearer "+login.Token)
	revisionResponseHTTP, err := http.DefaultClient.Do(revisionRequest)
	if err != nil {
		t.Fatal(err)
	}
	defer revisionResponseHTTP.Body.Close()
	var revision revisionResponse
	if err := json.NewDecoder(revisionResponseHTTP.Body).Decode(&revision); err != nil {
		t.Fatal(err)
	}
	if revision.CurrentRevision != 1 {
		t.Fatalf("revision = %d", revision.CurrentRevision)
	}
}

func TestSyncServerStoresTeamProgressEntities(t *testing.T) {
	api := testApp(t)
	changes := []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"执行者","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T16:30:00Z",
			Payload:   json.RawMessage(`{"id":"task_sync","projectId":"project_sync","primaryExecutorMemberId":"member_sync","expectedStartAt":"2026-05-10T09:00:00Z","expectedFinishAt":"2026-05-10T18:00:00Z","progressPercent":65,"progressNote":"接口联调中","status":"pending_review","reviewSubmittedAt":"2026-05-10T16:30:00Z","reviewSubmittedByMemberId":"member_sync","updatedAt":"2026-05-10T16:30:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_sync","taskId":"task_sync","executorMemberId":"member_sync","focusSessionId":"focus_sync","status":"active","startedAt":"2026-05-10T10:00:00Z","updatedAt":"2026-05-10T10:05:00Z"}`),
		},
		{
			Entity:    "execution_signal",
			ID:        "signal_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:00:00Z",
			Payload:   json.RawMessage(`{"id":"signal_sync","workSessionId":"work_session_sync","taskId":"task_sync","executorMemberId":"member_sync","type":"work_started","createdAt":"2026-05-10T10:00:00Z","payload":{"mode":"focus"}}`),
		},
	}

	pushed := pushRows(t, api, ownerAuth(), "device_a", changes)
	if len(pushed.Accepted) != len(changes) {
		t.Fatalf("accepted = %d, want %d, conflicts = %#v", len(pushed.Accepted), len(changes), pushed.Conflicts)
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	if len(pulled.Changes) != len(changes) {
		t.Fatalf("pulled changes = %d, want %d", len(pulled.Changes), len(changes))
	}
	body, err := json.Marshal(pulled.Changes)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{"project_sync", "member_sync", "work_session_sync", "signal_sync", "progressNote", "reviewSubmittedAt", "expectedStartAt", "expectedFinishAt"} {
		if !strings.Contains(string(body), expected) {
			t.Fatalf("pulled changes missing %q: %s", expected, string(body))
		}
	}
}

func TestSyncServerPublishesWorkspaceEventsOnPush(t *testing.T) {
	api := testApp(t)
	events, unsubscribe := api.subscribeWorkspace("workspace_test")
	defer unsubscribe()

	pushed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})
	if len(pushed.Accepted) != 1 {
		t.Fatalf("accepted = %d", len(pushed.Accepted))
	}

	select {
	case event := <-events:
		if event.WorkspaceID != "workspace_test" || event.CurrentRevision != pushed.CurrentRevision || event.DeviceID != "device_a" {
			t.Fatalf("unexpected sync event: %#v", event)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for sync event")
	}
}

func TestSyncServerEventsEndpointAcceptsQueryToken(t *testing.T) {
	api := testApp(t)
	token, err := api.signToken(tokenClaims{
		AccountID:   "account_owner",
		WorkspaceID: "workspace_test",
		Exp:         time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	req := httptest.NewRequest(http.MethodGet, "/sync/events?token="+token+"&device_id=device_b", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		api.handleEvents(recorder, req)
		close(done)
	}()
	time.Sleep(10 * time.Millisecond)
	cancel()
	select {
	case <-done:
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for events handler to exit")
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("events status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	body := recorder.Body.String()
	if !strings.Contains(body, "event: hello") || !strings.Contains(body, `"current_revision"`) {
		t.Fatalf("events endpoint did not emit hello event: %s", body)
	}
}

func TestSyncServerEventsEndpointBroadcastsSameDeviceRevisions(t *testing.T) {
	api := testApp(t)
	token, err := api.signToken(tokenClaims{
		AccountID:   "account_owner",
		WorkspaceID: "workspace_test",
		Exp:         time.Now().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	req := httptest.NewRequest(http.MethodGet, "/sync/events?token="+token+"&device_id=device_a", nil).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		api.handleEvents(recorder, req)
		close(done)
	}()
	time.Sleep(10 * time.Millisecond)

	pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_same_device_event",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_same_device_event","name":"同设备事件","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})

	deadline := time.Now().Add(time.Second)
	for time.Now().Before(deadline) {
		if strings.Contains(recorder.Body.String(), "event: revision") {
			cancel()
			<-done
			return
		}
		time.Sleep(10 * time.Millisecond)
	}
	cancel()
	<-done
	t.Fatalf("events endpoint did not broadcast same-device revision: %s", recorder.Body.String())
}

func TestSyncServerRevisionEndpointReturnsCurrentRevision(t *testing.T) {
	api := testApp(t)
	pushed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_revision",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_revision","name":"Revision","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})

	recorder := httptest.NewRecorder()
	api.handleRevision(recorder, httptest.NewRequest(http.MethodGet, "/sync/revision", nil), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("revision status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response revisionResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.CurrentRevision != pushed.CurrentRevision {
		t.Fatalf("revision = %d, want %d", response.CurrentRevision, pushed.CurrentRevision)
	}
}

func TestSyncServerAllowsWorkspaceAccountToManageProjectTasks(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_open_manage",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_open_manage","name":"开放项目","updatedAt":"2026-05-10T08:01:00Z"}`),
		},
	})
	if len(seed.Accepted) != 1 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}

	managed := pushRows(t, api, authContext{AccountID: "account_executor", WorkspaceID: "workspace_test"}, "device_b", []syncRow{
		{
			Entity:    "task",
			ID:        "task_open_manage",
			UpdatedAt: "2026-05-10T08:02:00Z",
			Payload:   json.RawMessage(`{"id":"task_open_manage","projectId":"project_open_manage","title":"开放任务","status":"in_progress","primaryExecutorMemberId":"member_missing","ownerReview":{"status":"approved"},"updatedAt":"2026-05-10T08:02:00Z"}`),
		},
	})
	if len(managed.Accepted) != 1 || len(managed.Conflicts) != 0 {
		t.Fatalf("workspace account manage result = accepted %d conflicts %d", len(managed.Accepted), len(managed.Conflicts))
	}
}

func TestMajorSyncFeaturesPublishAndPullQuickly(t *testing.T) {
	api := testApp(t)
	events, unsubscribe := api.subscribeWorkspace("workspace_test")
	defer unsubscribe()

	startedAt := time.Now()
	pushed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"project_realtime","name":"实时同步项目","description":"同步专项测试","defaultExpectedStartHours":24,"createdAt":"2026-06-18T09:00:00Z","updatedAt":"2026-06-18T09:00:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_realtime_owner",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_realtime_owner","projectId":"project_realtime","teamMemberId":"team_member_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","roles":["project_owner","executor"],"status":"active","createdAt":"2026-06-18T09:02:00Z","updatedAt":"2026-06-18T09:02:00Z"}`),
		},
		{
			Entity:    "team_member",
			ID:        "team_member_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:02:30Z",
			Payload:   json.RawMessage(`{"id":"team_member_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","status":"active","createdAt":"2026-06-18T09:02:30Z","updatedAt":"2026-06-18T09:02:30Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:03:00Z",
			Payload:   json.RawMessage(`{"id":"task_realtime","title":"实时同步任务","projectId":"project_realtime","project":"实时同步项目","creatorMemberId":"member_realtime_owner","primaryExecutorMemberId":"member_realtime_owner","priority":"medium","severity":"medium","stage":"development","estimatePomodoros":2,"actualPomodoros":0,"progressPercent":10,"progressNote":"刚开始","status":"committed","repeatRule":"none","subtasks":[],"collaboratorMemberIds":[],"estimateHistory":[],"sortOrder":1,"createdAt":"2026-06-18T09:03:00Z","updatedAt":"2026-06-18T09:03:00Z"}`),
		},
		{
			Entity:    "daily_plan",
			ID:        "plan_2026-06-18",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:04:00Z",
			Payload:   json.RawMessage(`{"id":"plan_2026-06-18","date":"2026-06-18","capacityPomodoros":8,"committedTaskIds":["task_realtime"],"completedPomodoros":0,"recommendedCapacityPomodoros":8,"suggestedCapacityPomodoros":8,"suggestedTaskIds":[],"overloadAcknowledged":false,"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-06-18T09:04:00Z","updatedAt":"2026-06-18T09:04:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_realtime","taskId":"task_realtime","executorMemberId":"member_realtime_owner","focusSessionId":"focus_realtime","status":"active","startedAt":"2026-06-18T09:05:00Z","totalPausedSeconds":0,"createdAt":"2026-06-18T09:05:00Z","updatedAt":"2026-06-18T09:05:00Z"}`),
		},
		{
			Entity:    "execution_signal",
			ID:        "signal_realtime",
			DeviceID:  "device_a",
			UpdatedAt: "2026-06-18T09:05:01Z",
			Payload:   json.RawMessage(`{"id":"signal_realtime","workSessionId":"work_session_realtime","taskId":"task_realtime","executorMemberId":"member_realtime_owner","type":"work_started","createdAt":"2026-06-18T09:05:01Z","payload":{"mode":"focus"}}`),
		},
	})
	if len(pushed.Accepted) != 7 || len(pushed.Conflicts) != 0 {
		t.Fatalf("accepted = %d conflicts = %#v", len(pushed.Accepted), pushed.Conflicts)
	}

	select {
	case event := <-events:
		if event.CurrentRevision != pushed.CurrentRevision || event.DeviceID != "device_a" {
			t.Fatalf("unexpected sync event: %#v", event)
		}
		if elapsed := time.Since(startedAt); elapsed > 200*time.Millisecond {
			t.Fatalf("sync event latency = %s, want <= 200ms", elapsed)
		}
	case <-time.After(time.Second):
		t.Fatal("timed out waiting for realtime sync event")
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	byKey := map[string]syncRow{}
	for _, change := range pulled.Changes {
		byKey[key(change.Entity, change.ID)] = change
	}
	for _, expected := range []string{
		key("project", "project_realtime"),
		key("team_member", "team_member_realtime"),
		key("project_member", "member_realtime_owner"),
		key("task", "task_realtime"),
		key("daily_plan", "plan_2026-06-18"),
		key("work_session", "work_session_realtime"),
		key("execution_signal", "signal_realtime"),
	} {
		if _, ok := byKey[expected]; !ok {
			t.Fatalf("pull missing %s from %#v", expected, byKey)
		}
	}

	updated := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
		{
			Entity:    "task",
			ID:        "task_realtime",
			DeviceID:  "device_b",
			UpdatedAt: "2026-06-18T09:10:00Z",
			Payload:   json.RawMessage(`{"id":"task_realtime","title":"实时同步任务","projectId":"project_realtime","project":"实时同步项目","creatorMemberId":"member_realtime_owner","primaryExecutorMemberId":"member_realtime_owner","priority":"medium","severity":"medium","stage":"development","estimatePomodoros":2,"actualPomodoros":0,"progressPercent":80,"progressNote":"即将提交","status":"pending_review","repeatRule":"none","subtasks":[],"collaboratorMemberIds":[],"estimateHistory":[],"sortOrder":1,"createdAt":"2026-06-18T09:03:00Z","updatedAt":"2026-06-18T09:10:00Z"}`),
		},
	})
	if len(updated.Accepted) != 1 || len(updated.Conflicts) != 0 {
		t.Fatalf("updated accepted = %d conflicts = %#v", len(updated.Accepted), updated.Conflicts)
	}
	deviceAPull := pullRows(t, api, ownerAuth(), pushed.CurrentRevision)
	if len(deviceAPull.Changes) != 1 || deviceAPull.Changes[0].ID != "task_realtime" {
		t.Fatalf("device A pull after update = %#v", deviceAPull.Changes)
	}
	if !strings.Contains(string(deviceAPull.Changes[0].Payload), `"progressPercent":80`) ||
		!strings.Contains(string(deviceAPull.Changes[0].Payload), `"status":"pending_review"`) {
		t.Fatalf("device A did not receive task progress/review update: %s", string(deviceAPull.Changes[0].Payload))
	}
}

func TestSyncServerConflictsAndDeletesTeamProgressEntities(t *testing.T) {
	api := testApp(t)
	initial := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"执行者","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
		{
			Entity:    "task",
			ID:        "task_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"task_sync","projectId":"project_sync","primaryExecutorMemberId":"member_sync","status":"in_progress","updatedAt":"2026-05-10T09:00:00Z"}`),
		},
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T10:05:00Z",
			Payload:   json.RawMessage(`{"id":"work_session_sync","taskId":"task_sync","focusSessionId":"focus_sync","status":"active","startedAt":"2026-05-10T10:00:00Z","updatedAt":"2026-05-10T10:05:00Z"}`),
		},
	})
	if len(initial.Accepted) != 4 {
		t.Fatalf("initial accepted = %d", len(initial.Accepted))
	}

	conflicted := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_b",
			UpdatedAt: "2026-05-10T08:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","name":"旧执行者","updatedAt":"2026-05-10T08:02:00Z"}`),
		},
	})
	if len(conflicted.Conflicts) != 1 || conflicted.Conflicts[0].Entity != "project_member" {
		t.Fatalf("expected project_member conflict, got %#v", conflicted.Conflicts)
	}

	deletedAt := "2026-05-10T11:00:00Z"
	deleted := pushRows(t, api, ownerAuth(), "device_b", []syncRow{
		{
			Entity:    "work_session",
			ID:        "work_session_sync",
			DeviceID:  "device_b",
			UpdatedAt: deletedAt,
			DeletedAt: deletedAt,
			Payload:   json.RawMessage(`{}`),
		},
	})
	if len(deleted.Accepted) != 1 || deleted.Accepted[0].DeletedAt != deletedAt {
		t.Fatalf("expected accepted work_session tombstone, got %#v", deleted.Accepted)
	}
	pulled := pullRows(t, api, ownerAuth(), initial.CurrentRevision)
	foundTombstone := false
	for _, change := range pulled.Changes {
		if change.Entity == "work_session" && change.ID == "work_session_sync" && change.DeletedAt == deletedAt {
			foundTombstone = true
		}
	}
	if !foundTombstone {
		t.Fatalf("pull did not include work_session tombstone: %#v", pulled.Changes)
	}
}

func TestBootstrapAndLoginCreateWorkspaceAccount(t *testing.T) {
	api := newApp(defaultConfig(), store{Version: 2, NextRevision: 1, Workspaces: map[string]workspaceData{}, Accounts: map[string]accountRecord{}, Users: map[string]userData{}})
	body := bytes.NewReader([]byte(`{"workspace_name":"交付团队","name":"负责人","email":"owner@example.com","password":"secret","device_id":"device_a"}`))
	recorder := httptest.NewRecorder()
	api.handleBootstrap(recorder, httptest.NewRequest(http.MethodPost, "/auth/bootstrap", body))
	if recorder.Code != http.StatusOK {
		t.Fatalf("bootstrap status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var bootstrap loginResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &bootstrap); err != nil {
		t.Fatal(err)
	}
	if bootstrap.Token == "" || bootstrap.Account.Email != "owner@example.com" || bootstrap.Workspace.Name != "交付团队" {
		t.Fatalf("unexpected bootstrap response: %#v", bootstrap)
	}
	stored := api.store.Accounts[bootstrap.Account.ID]
	if stored.PasswordHash == "secret" || stored.PasswordHash == "" || bootstrap.Account.PasswordHash != "" {
		t.Fatalf("password hash exposure/storage failed: response=%#v stored=%#v", bootstrap.Account, stored)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"owner@example.com","password":"secret","device_id":"device_b"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestProjectOwnerCreatesMemberAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	body := bytes.NewReader([]byte(`{"project_id":"project_sync","name":"执行者","email":"executor@example.com","password":"demo","roles":["executor"]}`))
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", body), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "executor@example.com" || response.Member.Entity != "project_member" {
		t.Fatalf("unexpected member response: %#v", response)
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+response.Member.ID, patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	loginBody := bytes.NewReader([]byte(`{"email":"executor@example.com","password":"new-demo","device_id":"device_executor"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	pulled := pullRows(t, api, ownerAuth(), 0)
	if len(pulled.Changes) != 4 {
		t.Fatalf("expected four workspace rows, got %d", len(pulled.Changes))
	}
}

func TestProjectOwnerCreatesWorkspaceMemberAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	body := []byte(`{"name":"成员库成员","email":"directory@example.com","password":"demo"}`)
	recorder := httptest.NewRecorder()
	api.handleMembers(recorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(body)), ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("create workspace member status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "directory@example.com" || response.Member.Entity != "team_member" {
		t.Fatalf("unexpected workspace member response: %#v", response)
	}
	duplicateBody := []byte(`{"name":"重复成员","email":"directory@example.com","password":"demo"}`)
	duplicateRecorder := httptest.NewRecorder()
	api.handleMembers(duplicateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(duplicateBody)), ownerAuth())
	if duplicateRecorder.Code != http.StatusOK {
		t.Fatalf("duplicate workspace member status = %d, body = %s", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
	var duplicateResponse memberResponse
	if err := json.Unmarshal(duplicateRecorder.Body.Bytes(), &duplicateResponse); err != nil {
		t.Fatal(err)
	}
	if duplicateResponse.Member.ID != response.Member.ID {
		t.Fatalf("duplicate workspace member should update existing member: %#v", duplicateResponse.Member)
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+response.Member.ID, patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch workspace member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	loginBody := bytes.NewReader([]byte(`{"email":"directory@example.com","password":"new-demo","device_id":"device_directory"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched workspace member password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestPatchLegacyAccountBackfillsMissingTeamMember(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 2 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}
	hash, err := hashPassword("old-demo")
	if err != nil {
		t.Fatal(err)
	}
	api.store.Accounts["account_legacy"] = accountRecord{
		ID:           "account_legacy",
		WorkspaceID:  "workspace_test",
		Name:         "旧成员",
		Email:        "legacy@example.com",
		PasswordHash: hash,
		CreatedAt:    "2026-05-10T08:00:00Z",
		UpdatedAt:    "2026-05-10T08:00:00Z",
	}
	patchBody := bytes.NewReader([]byte(`{"password":"new-demo"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/team_member_account_legacy", patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch legacy member status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	if _, exists := api.store.Workspaces["workspace_test"].Rows[key("team_member", "team_member_account_legacy")]; !exists {
		t.Fatalf("expected missing team_member row to be backfilled")
	}
	loginBody := bytes.NewReader([]byte(`{"email":"legacy@example.com","password":"new-demo","device_id":"device_legacy"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched legacy password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func TestPatchWorkspaceMemberBackfillsMissingAccount(t *testing.T) {
	api := testApp(t)
	seed := pushRows(t, api, ownerAuth(), "device_a", []syncRow{
		{
			Entity:    "project",
			ID:        "project_sync",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:01:00Z",
			Payload:   json.RawMessage(`{"id":"project_sync","name":"同步项目","defaultExpectedStartHours":6,"updatedAt":"2026-05-10T08:01:00Z"}`),
		},
		{
			Entity:    "project_member",
			ID:        "member_sync_owner",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:02:00Z",
			Payload:   json.RawMessage(`{"id":"member_sync_owner","projectId":"project_sync","accountId":"account_owner","name":"负责人","roles":["project_owner","executor"],"updatedAt":"2026-05-10T08:02:00Z"}`),
		},
		{
			Entity:    "team_member",
			ID:        "team_member_missing_account",
			DeviceID:  "device_a",
			UpdatedAt: "2026-05-10T08:03:00Z",
			Payload:   json.RawMessage(`{"id":"team_member_missing_account","accountId":"account_missing","name":"王硕","email":"wangshuo","status":"active","updatedAt":"2026-05-10T08:03:00Z"}`),
		},
	})
	if len(seed.Accepted) != 3 {
		t.Fatalf("seed accepted = %d", len(seed.Accepted))
	}

	patchBody := bytes.NewReader([]byte(`{"password":"123"}`))
	patchRecorder := httptest.NewRecorder()
	api.handleMemberByID(patchRecorder, httptest.NewRequest(http.MethodPatch, "/members/team_member_missing_account", patchBody), ownerAuth())
	if patchRecorder.Code != http.StatusOK {
		t.Fatalf("patch member missing account status = %d, body = %s", patchRecorder.Code, patchRecorder.Body.String())
	}
	account, exists := api.store.Accounts["account_missing"]
	if !exists {
		t.Fatalf("expected missing account to be backfilled")
	}
	if account.Email != "wangshuo" || !checkPassword("123", account.PasswordHash) {
		t.Fatalf("unexpected backfilled account: %#v", account)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"wangshuo","password":"123","device_id":"device_wangshuo"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with backfilled account status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
}

func testApp(t *testing.T) *app {
	t.Helper()
	return newApp(defaultConfig(), store{
		Version:      2,
		NextRevision: 1,
		Workspaces: map[string]workspaceData{
			"workspace_test": {
				ID:        "workspace_test",
				Name:      "测试团队",
				Rows:      map[string]syncRow{},
				CreatedAt: "2026-05-10T08:00:00Z",
				UpdatedAt: "2026-05-10T08:00:00Z",
			},
		},
		Accounts: map[string]accountRecord{
			"account_owner": {
				ID:          "account_owner",
				WorkspaceID: "workspace_test",
				Name:        "项目负责人",
				Email:       "owner@example.com",
				CreatedAt:   "2026-05-10T08:00:00Z",
				UpdatedAt:   "2026-05-10T08:00:00Z",
			},
		},
		Users: map[string]userData{},
	})
}

func ownerAuth() authContext {
	return authContext{AccountID: "account_owner", WorkspaceID: "workspace_test"}
}

func pushRows(t *testing.T, api *app, auth authContext, deviceID string, changes []syncRow) pushResponse {
	t.Helper()
	body, err := json.Marshal(pushRequest{DeviceID: deviceID, Changes: changes})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handlePush(recorder, httptest.NewRequest(http.MethodPost, "/sync/push", bytes.NewReader(body)), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("push status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pushResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func pullRows(t *testing.T, api *app, auth authContext, since int64) pullResponse {
	t.Helper()
	recorder := httptest.NewRecorder()
	api.handlePull(recorder, httptest.NewRequest(http.MethodGet, "/sync/pull?since="+strconv.FormatInt(since, 10), nil), auth)
	if recorder.Code != http.StatusOK {
		t.Fatalf("pull status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response pullResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	return response
}

func mysqlTestDSN(t *testing.T) (string, func()) {
	t.Helper()
	baseDSN := strings.TrimSpace(os.Getenv("TM_SYNC_TEST_MYSQL_DSN"))
	if baseDSN == "" {
		t.Skip("set TM_SYNC_TEST_MYSQL_DSN to run MySQL integration tests")
	}
	cfg, err := mysql.ParseDSN(baseDSN)
	if err != nil {
		t.Fatalf("invalid TM_SYNC_TEST_MYSQL_DSN: %v", err)
	}
	if cfg.DBName == "" {
		t.Fatal("TM_SYNC_TEST_MYSQL_DSN must include a database name")
	}
	dbName := "tm_test_" + strconv.FormatInt(time.Now().UnixNano(), 36)
	cfg.DBName = dbName
	dsn := cfg.FormatDSN()
	cleanup := func() {
		serverCfg := cfg
		serverCfg.DBName = ""
		serverDB, err := sql.Open("mysql", serverCfg.FormatDSN())
		if err != nil {
			t.Logf("cleanup mysql open failed: %v", err)
			return
		}
		defer serverDB.Close()
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if _, err := serverDB.ExecContext(ctx, "DROP DATABASE IF EXISTS `"+escapeMySQLIdentifier(dbName)+"`"); err != nil {
			t.Logf("cleanup mysql database %s failed: %v", dbName, err)
		}
	}
	return dsn, cleanup
}
