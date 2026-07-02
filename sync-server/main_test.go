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

func TestMemoryWorkspaceMemberCreationDoesNotWriteTeamRows(t *testing.T) {
	api := testApp(t)

	createBody := []byte(`{"name":"成员","email":"member@example.com","password":"member-secret"}`)
	createRecorder := httptest.NewRecorder()
	api.handleMembers(createRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(createBody)), ownerAuth())
	if createRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", createRecorder.Code, createRecorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(createRecorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "member@example.com" || response.Member.Entity != "" {
		t.Fatalf("workspace member response should only return account: %#v", response)
	}
	if len(api.store.Workspaces["workspace_test"].Rows) != 0 || api.store.NextRevision != 1 {
		t.Fatalf("workspace member creation should not create sync rows: %#v", api.store.Workspaces["workspace_test"].Rows)
	}
}

func TestMySQLWorkspaceMemberCreationDoesNotWriteTeamRows(t *testing.T) {
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

	workspaceBody := []byte(`{"name":"协作区"}`)
	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader(workspaceBody)), authContext{AccountID: login.Account.ID, WorkspaceID: login.Workspace.ID})
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: login.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	memberBody := []byte(`{"name":"成员","email":"member@example.com","password":"member-secret"}`)
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(memberBody)), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "member@example.com" || response.Member.Entity != "" {
		t.Fatalf("workspace member response should only return account: %#v", response)
	}
	var teamRows int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM sync_rows WHERE workspace_id = ? AND entity = 'team_member'`, sharedLogin.Workspace.ID).Scan(&teamRows); err != nil {
		t.Fatal(err)
	}
	if teamRows != 0 {
		t.Fatalf("team_member sync rows = %d", teamRows)
	}
	var membershipRows int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ? AND status = 'active'`, sharedLogin.Workspace.ID, response.Account.ID).Scan(&membershipRows); err != nil {
		t.Fatal(err)
	}
	if membershipRows != 1 {
		t.Fatalf("workspace membership rows = %d", membershipRows)
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

func TestMySQLWorkspaceInvitationAcceptAddsMembership(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"被邀请人","email":"invitee@example.com","password":"secret"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"邀请协作区"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	ownerStateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(ownerStateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), sharedAuth)
	if ownerStateRecorder.Code != http.StatusOK {
		t.Fatalf("owner team state status = %d, body = %s", ownerStateRecorder.Code, ownerStateRecorder.Body.String())
	}
	var ownerState pullResponse
	if err := json.Unmarshal(ownerStateRecorder.Body.Bytes(), &ownerState); err != nil {
		t.Fatal(err)
	}
	if len(ownerState.Changes) != 0 {
		t.Fatalf("owner team state should not include workspace member sync rows: %#v", ownerState.Changes)
	}

	inviteBody := bytes.NewReader([]byte(`{"workspace_id":"` + sharedLogin.Workspace.ID + `","email":"invitee@example.com"}`))
	inviteRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(inviteRecorder, httptest.NewRequest(http.MethodPost, "/workspace-invitations", inviteBody), sharedAuth)
	if inviteRecorder.Code != http.StatusOK {
		t.Fatalf("invite status = %d, body = %s", inviteRecorder.Code, inviteRecorder.Body.String())
	}
	var invitePayload struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteRecorder.Body.Bytes(), &invitePayload); err != nil {
		t.Fatal(err)
	}
	if invitePayload.Invitation.Status != "pending" || invitePayload.Invitation.InviteeAccountID != accountPayload.Account.ID {
		t.Fatalf("invitation = %#v", invitePayload.Invitation)
	}

	inviteeLoginRecorder := httptest.NewRecorder()
	api.handleLogin(inviteeLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"invitee@example.com","password":"secret","device_id":"device_invitee"}`))))
	if inviteeLoginRecorder.Code != http.StatusOK {
		t.Fatalf("invitee login status = %d, body = %s", inviteeLoginRecorder.Code, inviteeLoginRecorder.Body.String())
	}
	var inviteeLogin loginResponse
	if err := json.Unmarshal(inviteeLoginRecorder.Body.Bytes(), &inviteeLogin); err != nil {
		t.Fatal(err)
	}
	inviteeAuth := authContext{AccountID: inviteeLogin.Account.ID, WorkspaceID: inviteeLogin.Workspace.ID}

	listRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(listRecorder, httptest.NewRequest(http.MethodGet, "/workspace-invitations", nil), inviteeAuth)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list invitations status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	var listPayload struct {
		Invitations []workspaceInvitationSummary `json:"invitations"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Invitations) != 1 || listPayload.Invitations[0].ID != invitePayload.Invitation.ID {
		t.Fatalf("invitations = %#v", listPayload.Invitations)
	}

	acceptRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitationByID(acceptRecorder, httptest.NewRequest(http.MethodPost, "/workspace-invitations/"+invitePayload.Invitation.ID+"/accept", nil), inviteeAuth)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept invitation status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptedPayload struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(acceptRecorder.Body.Bytes(), &acceptedPayload); err != nil {
		t.Fatal(err)
	}
	if acceptedPayload.Invitation.Status != "accepted" || acceptedPayload.Invitation.AcceptedAt == "" {
		t.Fatalf("accepted invitation = %#v", acceptedPayload.Invitation)
	}

	var membershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ? AND status = 'active'`, sharedLogin.Workspace.ID, inviteeLogin.Account.ID).Scan(&membershipCount); err != nil {
		t.Fatal(err)
	}
	if membershipCount != 1 {
		t.Fatalf("membership count = %d", membershipCount)
	}

	workspacesRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspacesRecorder, httptest.NewRequest(http.MethodGet, "/workspaces", nil), inviteeAuth)
	if workspacesRecorder.Code != http.StatusOK {
		t.Fatalf("invitee workspaces status = %d, body = %s", workspacesRecorder.Code, workspacesRecorder.Body.String())
	}
	var workspacesPayload struct {
		Workspaces  []workspaceSummary           `json:"workspaces"`
		Memberships []workspaceMembershipSummary `json:"memberships"`
	}
	if err := json.Unmarshal(workspacesRecorder.Body.Bytes(), &workspacesPayload); err != nil {
		t.Fatal(err)
	}
	hasSharedWorkspace := false
	sharedMemberships := []workspaceMembershipSummary{}
	for _, workspace := range workspacesPayload.Workspaces {
		if workspace.ID == sharedLogin.Workspace.ID {
			hasSharedWorkspace = true
		}
	}
	for _, membership := range workspacesPayload.Memberships {
		if membership.WorkspaceID == sharedLogin.Workspace.ID {
			sharedMemberships = append(sharedMemberships, membership)
		}
	}
	if !hasSharedWorkspace {
		t.Fatalf("invitee workspaces missing shared workspace: %#v", workspacesPayload.Workspaces)
	}
	if len(sharedMemberships) != 1 || sharedMemberships[0].AccountID != inviteeLogin.Account.ID {
		t.Fatalf("invitee shared memberships should only include self: %#v", sharedMemberships)
	}

	inviteeStateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(inviteeStateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), inviteeAuth)
	if inviteeStateRecorder.Code != http.StatusOK {
		t.Fatalf("invitee team state status = %d, body = %s", inviteeStateRecorder.Code, inviteeStateRecorder.Body.String())
	}
	var inviteeState pullResponse
	if err := json.Unmarshal(inviteeStateRecorder.Body.Bytes(), &inviteeState); err != nil {
		t.Fatal(err)
	}
	if len(inviteeState.Changes) != 0 {
		t.Fatalf("invitee team state should not include workspace member sync rows: %#v", inviteeState.Changes)
	}
}

func TestMySQLProjectInvitationAcceptAddsProjectMembershipOnly(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"项目受邀人","email":"project-invitee@example.com","password":"secret"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"项目邀请协作区"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	workspaceID := sharedLogin.Workspace.ID
	seedRows := []syncRow{
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_invited", UpdatedAt: "2026-07-01T08:00:00Z", Payload: json.RawMessage(`{"id":"project_invited","workspaceId":"` + workspaceID + `","name":"受邀项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:00:00Z","updatedAt":"2026-07-01T08:00:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_other", UpdatedAt: "2026-07-01T08:01:00Z", Payload: json.RawMessage(`{"id":"project_other","workspaceId":"` + workspaceID + `","name":"其他项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:01:00Z","updatedAt":"2026-07-01T08:01:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_invited", UpdatedAt: "2026-07-01T08:02:00Z", Payload: json.RawMessage(`{"id":"task_invited","workspaceId":"` + workspaceID + `","projectId":"project_invited","project":"受邀项目","title":"受邀任务","status":"pool","createdAt":"2026-07-01T08:02:00Z","updatedAt":"2026-07-01T08:02:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_other", UpdatedAt: "2026-07-01T08:03:00Z", Payload: json.RawMessage(`{"id":"task_other","workspaceId":"` + workspaceID + `","projectId":"project_other","project":"其他项目","title":"其他任务","status":"pool","createdAt":"2026-07-01T08:03:00Z","updatedAt":"2026-07-01T08:03:00Z"}`)},
	}
	seedBody, err := json.Marshal(pushRequest{DeviceID: "device_seed", Changes: seedRows})
	if err != nil {
		t.Fatal(err)
	}
	seedRecorder := httptest.NewRecorder()
	api.handleTeamChanges(seedRecorder, httptest.NewRequest(http.MethodPost, "/team/changes", bytes.NewReader(seedBody)), sharedAuth)
	if seedRecorder.Code != http.StatusOK {
		t.Fatalf("seed team changes status = %d, body = %s", seedRecorder.Code, seedRecorder.Body.String())
	}

	inviteRecorder := httptest.NewRecorder()
	inviteBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_invited","email":"project-invitee@example.com","roles":["executor"]}`))
	api.handleProjectInvitations(inviteRecorder, httptest.NewRequest(http.MethodPost, "/project-invitations", inviteBody), sharedAuth)
	if inviteRecorder.Code != http.StatusOK {
		t.Fatalf("project invite status = %d, body = %s", inviteRecorder.Code, inviteRecorder.Body.String())
	}
	var invitePayload struct {
		Invitation projectInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteRecorder.Body.Bytes(), &invitePayload); err != nil {
		t.Fatal(err)
	}
	if invitePayload.Invitation.ProjectName != "受邀项目" || invitePayload.Invitation.InviteeAccountID != accountPayload.Account.ID {
		t.Fatalf("project invitation = %#v", invitePayload.Invitation)
	}

	inviteeLoginRecorder := httptest.NewRecorder()
	api.handleLogin(inviteeLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-invitee@example.com","password":"secret","device_id":"device_project_invitee"}`))))
	if inviteeLoginRecorder.Code != http.StatusOK {
		t.Fatalf("invitee login status = %d, body = %s", inviteeLoginRecorder.Code, inviteeLoginRecorder.Body.String())
	}
	var inviteeLogin loginResponse
	if err := json.Unmarshal(inviteeLoginRecorder.Body.Bytes(), &inviteeLogin); err != nil {
		t.Fatal(err)
	}
	inviteeAuth := authContext{AccountID: inviteeLogin.Account.ID, WorkspaceID: inviteeLogin.Workspace.ID}

	listRecorder := httptest.NewRecorder()
	api.handleProjectInvitations(listRecorder, httptest.NewRequest(http.MethodGet, "/project-invitations", nil), inviteeAuth)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list project invitations status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	var listPayload struct {
		Invitations []projectInvitationSummary `json:"invitations"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Invitations) != 1 || listPayload.Invitations[0].ID != invitePayload.Invitation.ID {
		t.Fatalf("project invitations = %#v", listPayload.Invitations)
	}

	acceptRecorder := httptest.NewRecorder()
	api.handleProjectInvitationByID(acceptRecorder, httptest.NewRequest(http.MethodPost, "/project-invitations/"+invitePayload.Invitation.ID+"/accept", nil), inviteeAuth)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept project invitation status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptedPayload struct {
		Invitation projectInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(acceptRecorder.Body.Bytes(), &acceptedPayload); err != nil {
		t.Fatal(err)
	}
	if acceptedPayload.Invitation.Status != "accepted" || acceptedPayload.Invitation.AcceptedAt == "" {
		t.Fatalf("accepted project invitation = %#v", acceptedPayload.Invitation)
	}

	var workspaceMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, workspaceID, inviteeLogin.Account.ID).Scan(&workspaceMembershipCount); err != nil {
		t.Fatal(err)
	}
	if workspaceMembershipCount != 0 {
		t.Fatalf("project invitation should not add workspace membership, got %d", workspaceMembershipCount)
	}
	var projectMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM team_project_members WHERE workspace_id = ? AND project_id = ? AND account_ref = ? AND deleted_at IS NULL AND COALESCE(NULLIF(status, ''), 'active') = 'active'`, workspaceID, "project_invited", inviteeLogin.Account.ID).Scan(&projectMembershipCount); err != nil {
		t.Fatal(err)
	}
	if projectMembershipCount != 1 {
		t.Fatalf("project membership count = %d", projectMembershipCount)
	}

	workspacesRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspacesRecorder, httptest.NewRequest(http.MethodGet, "/workspaces", nil), inviteeAuth)
	if workspacesRecorder.Code != http.StatusOK {
		t.Fatalf("project invitee workspaces status = %d, body = %s", workspacesRecorder.Code, workspacesRecorder.Body.String())
	}
	var workspacesPayload struct {
		Workspaces  []workspaceSummary           `json:"workspaces"`
		Memberships []workspaceMembershipSummary `json:"memberships"`
	}
	if err := json.Unmarshal(workspacesRecorder.Body.Bytes(), &workspacesPayload); err != nil {
		t.Fatal(err)
	}
	hasProjectWorkspace := false
	for _, workspace := range workspacesPayload.Workspaces {
		if workspace.ID == workspaceID {
			hasProjectWorkspace = true
		}
	}
	if !hasProjectWorkspace {
		t.Fatalf("project invitee workspaces missing project workspace: %#v", workspacesPayload.Workspaces)
	}
	for _, membership := range workspacesPayload.Memberships {
		if membership.WorkspaceID == workspaceID {
			t.Fatalf("project invitee should not receive workspace membership: %#v", workspacesPayload.Memberships)
		}
	}

	stateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(stateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), inviteeAuth)
	if stateRecorder.Code != http.StatusOK {
		t.Fatalf("project invitee team state status = %d, body = %s", stateRecorder.Code, stateRecorder.Body.String())
	}
	var stateResponse pullResponse
	if err := json.Unmarshal(stateRecorder.Body.Bytes(), &stateResponse); err != nil {
		t.Fatal(err)
	}
	visible := map[string]bool{}
	for _, row := range stateResponse.Changes {
		visible[row.Entity+"/"+row.ID] = true
	}
	if !visible["project/project_invited"] || !visible["task/task_invited"] {
		t.Fatalf("project invitee state missing invited project rows: %#v", visible)
	}
	if visible["project/project_other"] || visible["task/task_other"] {
		t.Fatalf("project invitee state leaked other project rows: %#v", visible)
	}
}

func TestMySQLWorkspaceUpdateCanChangeSharedWorkspaceOwner(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"新负责人","email":"new-owner@example.com","password":"secret"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"待转负责人协作区"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, sharedLogin.Workspace.ID, accountPayload.Account.ID, "member", "active", now); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, bytes.NewReader([]byte(`{"name":"已转负责人协作区","type":"shared","owner_account_id":"`+accountPayload.Account.ID+`"}`))),
		sharedAuth,
	)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("update workspace owner status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updatePayload struct {
		Workspace workspaceSummary `json:"workspace"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updatePayload); err != nil {
		t.Fatal(err)
	}
	if updatePayload.Workspace.OwnerAccountID != accountPayload.Account.ID {
		t.Fatalf("workspace owner = %q, want %q", updatePayload.Workspace.OwnerAccountID, accountPayload.Account.ID)
	}

	var oldOwnerRole string
	if err := db.QueryRowContext(context.Background(), `SELECT role FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, adminLogin.Account.ID).Scan(&oldOwnerRole); err != nil {
		t.Fatal(err)
	}
	if oldOwnerRole != "member" {
		t.Fatalf("old owner role = %q", oldOwnerRole)
	}
	var newOwnerRole string
	if err := db.QueryRowContext(context.Background(), `SELECT role FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, accountPayload.Account.ID).Scan(&newOwnerRole); err != nil {
		t.Fatal(err)
	}
	if newOwnerRole != "owner" {
		t.Fatalf("new owner role = %q", newOwnerRole)
	}
}

func TestMySQLWorkspaceUpdateCanMakeSharedWorkspacePrivate(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	for _, body := range []string{
		`{"name":"已加入成员","email":"joined@example.com","password":"secret"}`,
		`{"name":"待邀请成员","email":"pending@example.com","password":"secret"}`,
	} {
		recorder := httptest.NewRecorder()
		api.handleAdminAccounts(recorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(body))), adminAuth)
		if recorder.Code != http.StatusOK {
			t.Fatalf("create platform account status = %d, body = %s", recorder.Code, recorder.Body.String())
		}
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"协作待转私有"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	inviteJoinedRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(
		inviteJoinedRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations", bytes.NewReader([]byte(`{"workspace_id":"`+sharedLogin.Workspace.ID+`","email":"joined@example.com"}`))),
		sharedAuth,
	)
	if inviteJoinedRecorder.Code != http.StatusOK {
		t.Fatalf("invite joined status = %d, body = %s", inviteJoinedRecorder.Code, inviteJoinedRecorder.Body.String())
	}
	var joinedInvite struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteJoinedRecorder.Body.Bytes(), &joinedInvite); err != nil {
		t.Fatal(err)
	}

	joinedLoginRecorder := httptest.NewRecorder()
	api.handleLogin(joinedLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"joined@example.com","password":"secret","device_id":"device_joined"}`))))
	if joinedLoginRecorder.Code != http.StatusOK {
		t.Fatalf("joined login status = %d, body = %s", joinedLoginRecorder.Code, joinedLoginRecorder.Body.String())
	}
	var joinedLogin loginResponse
	if err := json.Unmarshal(joinedLoginRecorder.Body.Bytes(), &joinedLogin); err != nil {
		t.Fatal(err)
	}
	acceptRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitationByID(
		acceptRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations/"+joinedInvite.Invitation.ID+"/accept", nil),
		authContext{AccountID: joinedLogin.Account.ID, WorkspaceID: joinedLogin.Workspace.ID},
	)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}

	pendingRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(
		pendingRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations", bytes.NewReader([]byte(`{"workspace_id":"`+sharedLogin.Workspace.ID+`","email":"pending@example.com"}`))),
		sharedAuth,
	)
	if pendingRecorder.Code != http.StatusOK {
		t.Fatalf("invite pending status = %d, body = %s", pendingRecorder.Code, pendingRecorder.Body.String())
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, bytes.NewReader([]byte(`{"name":"转为私人","type":"private"}`))),
		sharedAuth,
	)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("update workspace status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updatePayload struct {
		Workspace workspaceSummary `json:"workspace"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updatePayload); err != nil {
		t.Fatal(err)
	}
	if updatePayload.Workspace.Type != "private" || updatePayload.Workspace.Name != "转为私人" {
		t.Fatalf("updated workspace = %#v", updatePayload.Workspace)
	}

	var joinedStatus string
	if err := db.QueryRowContext(context.Background(), `SELECT status FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, joinedLogin.Account.ID).Scan(&joinedStatus); err != nil {
		t.Fatal(err)
	}
	if joinedStatus != "disabled" {
		t.Fatalf("joined membership status = %q", joinedStatus)
	}
	var pendingStatus string
	if err := db.QueryRowContext(context.Background(), `SELECT status FROM workspace_invitations WHERE workspace_id = ? AND invitee_email = ?`, sharedLogin.Workspace.ID, "pending@example.com").Scan(&pendingStatus); err != nil {
		t.Fatal(err)
	}
	if pendingStatus != "cancelled" {
		t.Fatalf("pending invitation status = %q", pendingStatus)
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(context.Background(), db, joinedLogin.Account.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, workspace := range workspaces {
		if workspace.ID == sharedLogin.Workspace.ID {
			t.Fatalf("private workspace leaked to former member: %#v", workspaces)
		}
	}
}

func TestMySQLWorkspaceUpdateRejectsPrivateWorkspaceTypeChange(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}
	if login.Workspace.Type != "private" {
		t.Fatalf("login workspace = %#v", login.Workspace)
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+login.Workspace.ID, bytes.NewReader([]byte(`{"name":"仍是私人工作区","type":"shared"}`))),
		authContext{AccountID: login.Account.ID, WorkspaceID: login.Workspace.ID},
	)
	if updateRecorder.Code != http.StatusBadRequest {
		t.Fatalf("update private workspace status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}

	workspace, found, err := mysqlWorkspaceByID(context.Background(), db, login.Workspace.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !found || workspace.Type != "private" {
		t.Fatalf("workspace after rejected update = %#v, found=%v", workspace, found)
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

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := db.ExecContext(
		context.Background(),
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		 VALUES (?, ?, ?, 'member', 'active', ?, ?)
		 ON DUPLICATE KEY UPDATE status = 'active', updated_at = VALUES(updated_at)`,
		"membership_"+privateLogin.Workspace.ID+"_"+member.Account.ID,
		privateLogin.Workspace.ID,
		member.Account.ID,
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(context.Background(), `UPDATE accounts SET workspace_id = ? WHERE id = ?`, privateLogin.Workspace.ID, member.Account.ID); err != nil {
		t.Fatal(err)
	}

	memberLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"member-secret","device_id":"device_member"}`))
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", memberLoginBody))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
	var memberLogin loginResponse
	if err := json.Unmarshal(memberLoginRecorder.Body.Bytes(), &memberLogin); err != nil {
		t.Fatal(err)
	}
	if memberLogin.Workspace.ID == privateLogin.Workspace.ID {
		t.Fatalf("member defaulted into another account private workspace: %#v", memberLogin.Workspace)
	}
	memberPrivateID := privateWorkspaceID(member.Account.ID)
	hasMemberPrivate := false
	hasSharedWorkspace := false
	for _, workspace := range memberLogin.Workspaces {
		if workspace.ID == privateLogin.Workspace.ID {
			t.Fatalf("member workspaces leaked owner private workspace: %#v", memberLogin.Workspaces)
		}
		if workspace.ID == memberPrivateID {
			hasMemberPrivate = true
		}
		if workspace.ID == sharedLogin.Workspace.ID {
			hasSharedWorkspace = true
		}
	}
	if !hasMemberPrivate || !hasSharedWorkspace {
		t.Fatalf("member workspaces missing expected entries: %#v", memberLogin.Workspaces)
	}

	memberAuth := authContext{AccountID: memberLogin.Account.ID, WorkspaceID: memberLogin.Workspace.ID}
	deniedSwitchBody := bytes.NewReader([]byte(`{"workspace_id":"` + privateLogin.Workspace.ID + `","device_id":"device_member"}`))
	deniedSwitchRecorder := httptest.NewRecorder()
	api.handleSwitchWorkspace(deniedSwitchRecorder, httptest.NewRequest(http.MethodPost, "/auth/switch-workspace", deniedSwitchBody), memberAuth)
	if deniedSwitchRecorder.Code != http.StatusForbidden {
		t.Fatalf("switch into another private workspace status = %d, body = %s", deniedSwitchRecorder.Code, deniedSwitchRecorder.Body.String())
	}

	staleToken, err := api.signToken(tokenClaims{
		UserID:      memberLogin.Account.ID,
		AccountID:   memberLogin.Account.ID,
		WorkspaceID: privateLogin.Workspace.ID,
		Exp:         time.Now().UTC().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	staleRequest := httptest.NewRequest(http.MethodGet, "/sync/pull", nil)
	staleRequest.Header.Set("Authorization", "Bearer "+staleToken)
	staleRecorder := httptest.NewRecorder()
	api.withAuth(api.handlePull)(staleRecorder, staleRequest)
	if staleRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("stale private workspace token status = %d, body = %s", staleRecorder.Code, staleRecorder.Body.String())
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

func TestMySQLTeamStateAllProjectOnlyAccess(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, _, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), emptyStore(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	createSharedRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSharedRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"交付协作区"}`))), adminAuth)
	if createSharedRecorder.Code != http.StatusOK {
		t.Fatalf("create shared status = %d, body = %s", createSharedRecorder.Code, createSharedRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(createSharedRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: sharedLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	workspaceID := sharedLogin.Workspace.ID
	seedRows := []syncRow{
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_visible", UpdatedAt: "2026-07-01T08:00:00Z", Payload: json.RawMessage(`{"id":"project_visible","workspaceId":"` + workspaceID + `","name":"可见项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:00:00Z","updatedAt":"2026-07-01T08:00:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_hidden", UpdatedAt: "2026-07-01T08:01:00Z", Payload: json.RawMessage(`{"id":"project_hidden","workspaceId":"` + workspaceID + `","name":"不可见项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:01:00Z","updatedAt":"2026-07-01T08:01:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_visible", UpdatedAt: "2026-07-01T08:02:00Z", Payload: json.RawMessage(`{"id":"task_visible","workspaceId":"` + workspaceID + `","projectId":"project_visible","project":"可见项目","title":"可见任务","status":"pool","createdAt":"2026-07-01T08:02:00Z","updatedAt":"2026-07-01T08:02:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_hidden", UpdatedAt: "2026-07-01T08:03:00Z", Payload: json.RawMessage(`{"id":"task_hidden","workspaceId":"` + workspaceID + `","projectId":"project_hidden","project":"不可见项目","title":"不可见任务","status":"pool","createdAt":"2026-07-01T08:03:00Z","updatedAt":"2026-07-01T08:03:00Z"}`)},
	}
	seedBody, err := json.Marshal(pushRequest{DeviceID: "device_seed", Changes: seedRows})
	if err != nil {
		t.Fatal(err)
	}
	seedRecorder := httptest.NewRecorder()
	api.handleTeamChanges(seedRecorder, httptest.NewRequest(http.MethodPost, "/team/changes", bytes.NewReader(seedBody)), sharedAuth)
	if seedRecorder.Code != http.StatusOK {
		t.Fatalf("seed team changes status = %d, body = %s", seedRecorder.Code, seedRecorder.Body.String())
	}

	memberRecorder := httptest.NewRecorder()
	memberBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_visible","name":"项目成员","email":"project-only@example.com","password":"demo","roles":["executor"]}`))
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", memberBody), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create project-only member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}
	var sharedMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, workspaceID, member.Account.ID).Scan(&sharedMembershipCount); err != nil {
		t.Fatal(err)
	}
	if sharedMembershipCount != 0 {
		t.Fatalf("project-only member should not have workspace membership, got %d", sharedMembershipCount)
	}

	projectOnlyLoginRecorder := httptest.NewRecorder()
	api.handleLogin(projectOnlyLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"demo","device_id":"device_member"}`))))
	if projectOnlyLoginRecorder.Code != http.StatusOK {
		t.Fatalf("project-only login status = %d, body = %s", projectOnlyLoginRecorder.Code, projectOnlyLoginRecorder.Body.String())
	}
	var projectOnlyLogin loginResponse
	if err := json.Unmarshal(projectOnlyLoginRecorder.Body.Bytes(), &projectOnlyLogin); err != nil {
		t.Fatal(err)
	}
	projectOnlyAuth := authContext{AccountID: projectOnlyLogin.Account.ID, WorkspaceID: projectOnlyLogin.Workspace.ID}
	stateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(stateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), projectOnlyAuth)
	if stateRecorder.Code != http.StatusOK {
		t.Fatalf("team state all status = %d, body = %s", stateRecorder.Code, stateRecorder.Body.String())
	}
	var stateResponse pullResponse
	if err := json.Unmarshal(stateRecorder.Body.Bytes(), &stateResponse); err != nil {
		t.Fatal(err)
	}
	visible := map[string]bool{}
	for _, row := range stateResponse.Changes {
		visible[row.Entity+"/"+row.ID] = true
	}
	if !visible["project/project_visible"] || !visible["task/task_visible"] {
		t.Fatalf("project-only state missing visible project rows: %#v", visible)
	}
	if visible["project/project_hidden"] || visible["task/task_hidden"] {
		t.Fatalf("project-only state leaked hidden project rows: %#v", visible)
	}

	disableRecorder := httptest.NewRecorder()
	disableBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","status":"disabled","roles":["executor"]}`))
	api.handleMemberByID(disableRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+member.Member.ID, disableBody), sharedAuth)
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("disable project member status = %d, body = %s", disableRecorder.Code, disableRecorder.Body.String())
	}

	rejoinRecorder := httptest.NewRecorder()
	rejoinBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_visible","name":"项目成员","email":"project-only@example.com","password":"should-not-change","roles":["executor"]}`))
	api.handleMembers(rejoinRecorder, httptest.NewRequest(http.MethodPost, "/members", rejoinBody), sharedAuth)
	if rejoinRecorder.Code != http.StatusOK {
		t.Fatalf("rejoin project member status = %d, body = %s", rejoinRecorder.Code, rejoinRecorder.Body.String())
	}

	oldPasswordRecorder := httptest.NewRecorder()
	api.handleLogin(oldPasswordRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"demo","device_id":"device_member_old_password"}`))))
	if oldPasswordRecorder.Code != http.StatusOK {
		t.Fatalf("project-only old password login status = %d, body = %s", oldPasswordRecorder.Code, oldPasswordRecorder.Body.String())
	}
	changedPasswordRecorder := httptest.NewRecorder()
	api.handleLogin(changedPasswordRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"should-not-change","device_id":"device_member_changed_password"}`))))
	if changedPasswordRecorder.Code == http.StatusOK {
		t.Fatalf("project-level rejoin should not change existing account password")
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
			Payload:   json.RawMessage(`{"id":"member_realtime_owner","projectId":"project_realtime","accountId":"account_owner","name":"测试成员","email":"owner@example.com","roles":["project_owner","executor"],"status":"active","createdAt":"2026-06-18T09:02:00Z","updatedAt":"2026-06-18T09:02:00Z"}`),
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
	if len(pushed.Accepted) != 6 || len(pushed.Conflicts) != 0 {
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
	if len(pulled.Changes) != 3 {
		t.Fatalf("expected three workspace rows, got %d", len(pulled.Changes))
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
	if response.Account.Email != "directory@example.com" || response.Member.Entity != "" {
		t.Fatalf("unexpected workspace member response: %#v", response)
	}
	duplicateBody := []byte(`{"name":"重复成员","email":"directory@example.com","password":"new-demo"}`)
	duplicateRecorder := httptest.NewRecorder()
	api.handleMembers(duplicateRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(duplicateBody)), ownerAuth())
	if duplicateRecorder.Code != http.StatusOK {
		t.Fatalf("duplicate workspace member status = %d, body = %s", duplicateRecorder.Code, duplicateRecorder.Body.String())
	}
	var duplicateResponse memberResponse
	if err := json.Unmarshal(duplicateRecorder.Body.Bytes(), &duplicateResponse); err != nil {
		t.Fatal(err)
	}
	if duplicateResponse.Account.ID != response.Account.ID || duplicateResponse.Member.Entity != "" {
		t.Fatalf("duplicate workspace member should update account only: %#v", duplicateResponse)
	}
	loginBody := bytes.NewReader([]byte(`{"email":"directory@example.com","password":"new-demo","device_id":"device_directory"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login with patched workspace member password status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
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
