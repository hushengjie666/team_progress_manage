package main

import (
	"context"
	"encoding/json"
	"testing"
)

func TestBusinessPatchUsesCurrentRowWithoutClientRevision(t *testing.T) {
	api := mysqlSeededApp(t)
	row := businessRow{
		WorkspaceID: "workspace_test",
		Entity:      "project",
		ID:          "project_last_write_wins",
		UpdatedAt:   "2026-07-17T01:00:00Z",
		Payload:     json.RawMessage(`{"id":"project_last_write_wins","workspaceId":"workspace_test","name":"first","createdAt":"2026-07-17T01:00:00Z","updatedAt":"2026-07-17T01:00:00Z"}`),
	}
	saveRows(t, api, ownerAuth(), "", []businessRow{row})

	tx, err := api.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer mysqlRollback(tx)
	failure := applyBusinessOperation(context.Background(), tx, ownerAuth(), businessOperation{
		Operation:   "patch",
		WorkspaceID: row.WorkspaceID,
		Entity:      row.Entity,
		ID:          row.ID,
		UpdatedAt:   "2026-07-17T01:01:00Z",
		Patch:       json.RawMessage(`{"name":"second"}`),
	})
	if failure.status != 0 {
		t.Fatalf("patch failed: %d %s", failure.status, failure.message)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	loaded, found, err := businessExistingRow(context.Background(), api.db, row.WorkspaceID, row.Entity, row.ID)
	if err != nil || !found {
		t.Fatalf("load row: found=%v err=%v", found, err)
	}
	if name := stringField(loaded.Payload, "name"); name != "second" {
		t.Fatalf("name = %q", name)
	}
}

func TestBusinessPatchDoesNotOverwriteUnrelatedFields(t *testing.T) {
	api := mysqlSeededApp(t)
	row := businessRow{WorkspaceID: "workspace_test", Entity: "task", ID: "task_field_merge", UpdatedAt: "2026-07-17T01:00:00Z", Payload: json.RawMessage(`{"id":"task_field_merge","workspaceId":"workspace_test","projectId":"project_test","title":"before","priority":"high","createdAt":"2026-07-17T01:00:00Z","updatedAt":"2026-07-17T01:00:00Z"}`)}
	saveRows(t, api, ownerAuth(), "", []businessRow{row})
	tx, err := api.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer mysqlRollback(tx)
	failure := applyBusinessOperation(context.Background(), tx, ownerAuth(), businessOperation{Operation: "patch", WorkspaceID: row.WorkspaceID, Entity: row.Entity, ID: row.ID, Patch: json.RawMessage(`{"title":"after"}`)})
	if failure.status != 0 {
		t.Fatalf("patch failed: %d %s", failure.status, failure.message)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	loaded, _, _ := businessExistingRow(context.Background(), api.db, row.WorkspaceID, row.Entity, row.ID)
	if stringField(loaded.Payload, "title") != "after" || stringField(loaded.Payload, "priority") != "high" {
		t.Fatalf("payload = %s", loaded.Payload)
	}
}
