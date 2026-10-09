package main

import (
	"context"
	"fmt"
	"testing"
	"time"
)

func TestRelationalMigrationPreservesAllSupportedUpgradesAndRollback(t *testing.T) {
	if !pendingMigrationNeedsBackup(13, 14) {
		t.Fatal("populated relational migration must require backup")
	}
	for version := int64(1); version <= 13; version++ {
		t.Run(fmt.Sprintf("schema_%d", version), func(t *testing.T) {
			dsn, cleanup := mysqlTestDSN(t)
			defer cleanup()
			db, err := openMySQLDB(dsn)
			if err != nil {
				t.Fatal(err)
			}
			defer db.Close()
			ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
			defer cancel()
			provider, err := newMigrationProvider(db)
			if err != nil {
				t.Fatal(err)
			}
			if _, err := provider.UpTo(ctx, version); err != nil {
				t.Fatal(err)
			}
			fixtures := relationalFixtureRows()
			for _, row := range fixtures {
				spec, _ := businessTableForEntity(row.Entity)
				_, err := db.ExecContext(ctx, "INSERT INTO "+spec.table+" (workspace_id,id,account_id,project_id,task_id,account_ref,status,kind,row_date,updated_at,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?)", row.WorkspaceID, row.ID, row.AccountID, nullString(businessProjectID(row)), nullString(businessTaskID(row)), nullString(businessAccountRef(row)), nullString(businessStatus(row)), nullString(businessKind(row)), nullString(businessRowDate(row)), row.UpdatedAt, row.Payload)
				if err != nil {
					t.Fatal(err)
				}
			}
			// Use the provider directly only in this isolated test database; production uses the backup gate.
			if _, err := provider.Up(ctx); err != nil {
				t.Fatal(err)
			}
			for _, row := range fixtures {
				loaded, found, err := businessExistingRow(ctx, db, row.WorkspaceID, row.Entity, row.ID)
				if err != nil || !found {
					t.Fatalf("load %s: %v", row.Entity, err)
				}
				assertRelationalJSON(t, row.Payload, loaded.Payload)
			}
			// Make the snapshot stale; Down must reconstruct it from authoritative data.
			for _, spec := range businessEntityTables {
				if _, err := db.ExecContext(ctx, "UPDATE "+spec.table+" SET payload=JSON_SET(payload,'$.title','stale')"); err != nil {
					t.Fatal(err)
				}
			}
			if _, err := provider.DownTo(ctx, 13); err != nil {
				t.Fatal(err)
			}
			for _, row := range fixtures {
				spec, _ := businessTableForEntity(row.Entity)
				var raw []byte
				if err := db.QueryRowContext(ctx, "SELECT payload FROM "+spec.table+" WHERE workspace_id=? AND id=?", row.WorkspaceID, row.ID).Scan(&raw); err != nil {
					t.Fatal(err)
				}
				// Unknown extension keys deliberately remain; title is core only for task.
				want := row.Payload
				if row.Entity != "task" {
					want, _ = applyBusinessMergePatch(want, []byte(`{"title":"stale"}`))
				}
				assertRelationalJSON(t, want, raw)
			}
			if _, err := provider.Up(ctx); err != nil {
				t.Fatal(err)
			}
		})
	}
}

func TestRelationalMigrationAcceptsUnsignedJSONNumbers(t *testing.T) {
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
	if _, err = provider.UpTo(ctx, 13); err != nil {
		t.Fatal(err)
	}
	_, err = db.ExecContext(ctx, `INSERT INTO business_tasks (workspace_id,id,updated_at,payload) VALUES ('unsigned_workspace','unsigned_task','2026-10-09T00:00:00Z',JSON_OBJECT('sortOrder', CAST(60 AS UNSIGNED)))`)
	if err != nil {
		t.Fatal(err)
	}
	if _, err = provider.Up(ctx); err != nil {
		t.Fatal(err)
	}
	var value float64
	if err = db.QueryRowContext(ctx, "SELECT core_sort_order FROM business_tasks WHERE id='unsigned_task'").Scan(&value); err != nil || value != 60 {
		t.Fatalf("unsigned core number: %v %v", value, err)
	}
}
