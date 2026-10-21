package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"testing"
)

func TestProjectAutoAcceptanceMigrationPreservesDefaultsAndExplicitChoices(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	provider, err := newMigrationProvider(db)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := provider.UpTo(ctx, 17); err != nil {
		t.Fatal(err)
	}
	for _, item := range []struct{ id, payload string }{
		{"default", `{}`}, {"enabled", `{"autoAcceptCompletedTasks":true}`}, {"disabled", `{"autoAcceptCompletedTasks":false}`},
	} {
		if _, err := db.ExecContext(ctx, `INSERT INTO business_projects (workspace_id,id,account_id,updated_at,payload) VALUES ('workspace_test',?,'account_owner','now',?)`, item.id, item.payload); err != nil {
			t.Fatal(err)
		}
	}
	for cycle := 0; cycle < 2; cycle++ {
		if _, err := provider.Up(ctx); err != nil {
			t.Fatal(err)
		}
		for id, expected := range map[string]sql.NullBool{
			"default": {}, "enabled": {Bool: true, Valid: true}, "disabled": {Bool: false, Valid: true},
		} {
			var actual sql.NullBool
			if err := db.QueryRowContext(ctx, `SELECT core_auto_accept_completed_tasks FROM business_projects WHERE id=?`, id).Scan(&actual); err != nil || actual != expected {
				t.Fatalf("cycle %d project %s: got %#v, want %#v, err=%v", cycle, id, actual, expected, err)
			}
		}
		// Down must preserve authoritative values even when the JSON snapshot is stale.
		if _, err := db.ExecContext(ctx, `UPDATE business_projects SET payload=JSON_SET(payload,'$.autoAcceptCompletedTasks',true)`); err != nil {
			t.Fatal(err)
		}
		if _, err := provider.DownTo(ctx, 17); err != nil {
			t.Fatal(err)
		}
		for id, expected := range map[string]any{"default": nil, "enabled": true, "disabled": false} {
			var raw []byte
			if err := db.QueryRowContext(ctx, `SELECT payload FROM business_projects WHERE id=?`, id).Scan(&raw); err != nil {
				t.Fatal(err)
			}
			var payload map[string]any
			if err := json.Unmarshal(raw, &payload); err != nil {
				t.Fatal(err)
			}
			if payload["autoAcceptCompletedTasks"] != expected {
				t.Fatalf("rollback project %s: %s", id, raw)
			}
		}
	}
}
