package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-sql-driver/mysql"
)

func TestBusinessCreateFailureOnlyTreatsDuplicateKeysAsConflict(t *testing.T) {
	duplicate := businessCreateFailure(&mysql.MySQLError{Number: 1062, Message: "duplicate"})
	if duplicate.status != http.StatusConflict {
		t.Fatalf("duplicate status = %d", duplicate.status)
	}
	databaseFailure := businessCreateFailure(errors.New("database unavailable"))
	if databaseFailure.status != http.StatusInternalServerError {
		t.Fatalf("database failure status = %d", databaseFailure.status)
	}
}

func TestTeamDataRejectsLegacySnapshotWrites(t *testing.T) {
	api := newApp(defaultConfig(), nil)
	body, err := json.Marshal(teamDataSaveRequest{Rows: []businessRow{}})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handleTeamDataSave(recorder, httptest.NewRequest(http.MethodPut, "/team/data", bytes.NewReader(body)), ownerAuth())
	if recorder.Code != http.StatusUpgradeRequired {
		t.Fatalf("legacy write status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
}

func TestMySQLBusinessMutationsAreExplicitAtomicAndVersioned(t *testing.T) {
	api := mysqlSeededApp(t)
	seedProjectOwnerRows(t, api)
	saveRows(t, api, ownerAuth(), "device", []businessRow{
		{WorkspaceID: "workspace_test", Entity: "task", ID: "task_first", UpdatedAt: "2026-07-11T01:00:00Z", Payload: json.RawMessage(`{"id":"task_first","workspaceId":"workspace_test","projectId":"project_sync","title":"第一项","status":"pool","updatedAt":"2026-07-11T01:00:00Z"}`)},
		{WorkspaceID: "workspace_test", Entity: "task", ID: "task_second", UpdatedAt: "2026-07-11T01:00:00Z", Payload: json.RawMessage(`{"id":"task_second","workspaceId":"workspace_test","projectId":"project_sync","title":"第二项","status":"pool","updatedAt":"2026-07-11T01:00:00Z"}`)},
	})

	loaded := loadRows(t, api, ownerAuth(), 0)
	rows := map[string]businessRow{}
	for _, row := range loaded.Rows {
		rows[row.Entity+"/"+row.ID] = row
	}
	first := rows["task/task_first"]
	second := rows["task/task_second"]
	patch := businessOperation{Operation: "patch", WorkspaceID: first.WorkspaceID, Entity: first.Entity, ID: first.ID, ExpectedRevision: first.Revision, UpdatedAt: "2026-07-11T01:01:00Z", Patch: json.RawMessage(`{"title":"第一项已更新","updatedAt":"2026-07-11T01:01:00Z"}`)}
	assertBusinessSaveStatus(t, api, ownerAuth(), []businessOperation{patch}, http.StatusOK)
	assertBusinessSaveStatus(t, api, ownerAuth(), []businessOperation{patch}, http.StatusConflict)

	atomicOperations := []businessOperation{
		{Operation: "patch", WorkspaceID: second.WorkspaceID, Entity: second.Entity, ID: second.ID, ExpectedRevision: second.Revision, UpdatedAt: "2026-07-11T01:02:00Z", Patch: json.RawMessage(`{"title":"不应提交"}`)},
		patch,
	}
	assertBusinessSaveStatus(t, api, ownerAuth(), atomicOperations, http.StatusConflict)

	reloaded := loadRows(t, api, ownerAuth(), 0)
	for _, row := range reloaded.Rows {
		if row.ID == second.ID && stringField(row.Payload, "title") != "第二项" {
			t.Fatalf("atomic conflict partially updated second task: %s", row.Payload)
		}
		if row.ID == first.ID {
			if row.AccountID != ownerAuth().AccountID {
				t.Fatalf("task owner changed to %q", row.AccountID)
			}
			assertBusinessSaveStatus(t, api, ownerAuth(), []businessOperation{{Operation: "delete", WorkspaceID: row.WorkspaceID, Entity: row.Entity, ID: row.ID, ExpectedRevision: row.Revision}}, http.StatusOK)
		}
	}
	finalRows := loadRows(t, api, ownerAuth(), 0)
	for _, row := range finalRows.Rows {
		if row.ID == first.ID {
			t.Fatalf("explicitly deleted task still exists")
		}
		if row.ID == second.ID {
			return
		}
	}
	t.Fatalf("unrelated task was deleted")
}

func assertBusinessSaveStatus(t *testing.T, api *app, auth authContext, operations []businessOperation, expected int) {
	t.Helper()
	body, err := json.Marshal(teamDataSaveRequest{ProtocolVersion: 2, Operations: operations})
	if err != nil {
		t.Fatal(err)
	}
	recorder := httptest.NewRecorder()
	api.handleTeamDataSave(recorder, httptest.NewRequest(http.MethodPut, "/team/data", bytes.NewReader(body)), auth)
	if recorder.Code != expected {
		t.Fatalf("save status = %d, want %d, body = %s", recorder.Code, expected, recorder.Body.String())
	}
}
