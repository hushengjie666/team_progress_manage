package main

import (
	"context"
	"encoding/json"
	"testing"
)

func TestMutationRecorderReturnsRowsDeletedAndSettings(t *testing.T) {
	ctx, recorder := withMutationRecorder(context.Background(), "mutation_test")
	row := businessRow{WorkspaceID: "workspace_test", AccountID: "account_test", Entity: "task", ID: "task_test", UpdatedAt: "2026-08-19T04:00:00Z", Payload: json.RawMessage(`{"id":"task_test"}`)}
	mutationRecorderFromContext(ctx).recordRow(row)
	recorder.recordDeleted(row)
	recorder.recordSettings(map[string]any{"soundEnabled": false})
	delta := recorder.response()
	if delta.MutationID != "mutation_test" || !delta.Delta || len(delta.Rows) != 0 || len(delta.Deleted) != 1 {
		t.Fatalf("unexpected delta: %#v", delta)
	}
	if delta.Deleted[0].preimage.ID != row.ID || delta.Settings["soundEnabled"] != false || delta.ServerTime == "" {
		t.Fatalf("delta metadata missing: %#v", delta)
	}
}
