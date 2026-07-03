package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestMySQLStoreRequiresDSN(t *testing.T) {
	db, err := openMySQLStore("")
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
func TestMySQLSchemaEnsureIsIdempotentAndCurrent(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	if err := ensureMySQLSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}
	if err := ensureMySQLSchema(context.Background(), db); err != nil {
		t.Fatal(err)
	}

	for _, table := range []string{
		"sync_meta",
		"workspaces",
		"accounts",
		"workspace_memberships",
		"workspace_invitations",
		"project_invitations",
		"team_projects",
		"team_project_members",
		"team_tasks",
		"team_daily_plans",
		"team_focus_sessions",
		"team_work_sessions",
		"team_execution_signals",
		"team_interruptions",
		"team_settings",
		"team_reward_state",
	} {
		exists, err := mysqlTableExists(context.Background(), db, table)
		if err != nil {
			t.Fatal(err)
		}
		if !exists {
			t.Fatalf("expected table %s to exist", table)
		}
	}
	for _, table := range []string{"schema_migrations", "sync_rows", "team_team_members", "team_strict_violations", "team_block_profiles", "team_onboarding"} {
		exists, err := mysqlTableExists(context.Background(), db, table)
		if err != nil {
			t.Fatal(err)
		}
		if exists {
			t.Fatalf("legacy table %s should not exist", table)
		}
	}
}
func TestMySQLStoreRoundTrip(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()

	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

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
func TestMySQLIncrementalHandlersDoNotDependOnMemoryStore(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
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
	}
	if err := saveStoreToMySQL(db, seed); err != nil {
		t.Fatal(err)
	}
	api := newApp(defaultConfig(), db)

	pushed := pushRows(t, api, ownerAuth(), "device_mysql", []syncRow{
		{
			Entity:    "project",
			ID:        "project_incremental",
			UpdatedAt: "2026-06-29T09:00:00Z",
			Payload:   json.RawMessage(`{"id":"project_incremental","name":"增量项目","updatedAt":"2026-06-29T09:00:00Z"}`),
		},
	})
	if pushed.CurrentRevision != 1 {
		t.Fatalf("push response = %#v", pushed)
	}

	pulled := pullRows(t, api, ownerAuth(), 0)
	if len(pulled.Changes) != 1 || pulled.Changes[0].ID != "project_incremental" || pulled.CurrentRevision != 1 {
		t.Fatalf("pull response = %#v", pulled)
	}
	revisionRecorder := httptest.NewRecorder()
	api.handleTeamRevision(revisionRecorder, httptest.NewRequest(http.MethodGet, "/team/revision", nil), ownerAuth())
	var revision revisionResponse
	if err := json.Unmarshal(revisionRecorder.Body.Bytes(), &revision); err != nil {
		t.Fatal(err)
	}
	if revision.CurrentRevision != 1 {
		t.Fatalf("revision = %d", revision.CurrentRevision)
	}
}
