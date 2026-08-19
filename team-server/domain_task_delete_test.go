package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDeletingTaskCleansPlansAndActiveSessions(t *testing.T) {
	api := mysqlSeededApp(t)
	now := "2026-07-17T08:00:00Z"
	project := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project", ID: "project_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"project_delete_test","workspaceId":"workspace_test","name":"Delete test","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	member := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project_member", ID: "member_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"member_delete_test","workspaceId":"workspace_test","projectId":"project_delete_test","accountId":"account_owner","name":"Owner","roles":["executor","project_owner"],"status":"active","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	task := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "task", ID: "task_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"task_delete_test","workspaceId":"workspace_test","projectId":"project_delete_test","title":"Delete me","status":"in_progress","primaryExecutorMemberId":"member_delete_test","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	plan := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "daily_plan", ID: "plan_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"plan_delete_test","workspaceId":"workspace_test","ownerAccountId":"account_owner","date":"2026-07-17","committedTaskIds":["task_delete_test"],"suggestedTaskIds":["task_delete_test"],"createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	focus := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "focus_session", ID: "focus_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"focus_delete_test","workspaceId":"workspace_test","taskId":"task_delete_test","mode":"focus","duration":1500,"startedAt":"2026-07-17T08:00:00Z","interruptionCounts":{"internal":0,"external":0}}`)}
	work := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "work_session", ID: "work_delete_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"work_delete_test","workspaceId":"workspace_test","taskId":"task_delete_test","focusSessionId":"focus_delete_test","status":"active","startedAt":"2026-07-17T08:00:00Z","totalPausedSeconds":0,"updatedAt":"2026-07-17T08:00:00Z"}`)}
	saveRows(t, api, ownerAuth(), "", []businessRow{project, member, task, plan, focus, work})

	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/tasks/task_delete_test?workspace_id=workspace_test", nil)
	request.Header.Set("Idempotency-Key", "delete-task-test")
	api.deleteBusinessResource(recorder, request, ownerAuth(), domainResourceByEntity("task"), task.ID)
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var delta mutationDeltaResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &delta); err != nil {
		t.Fatal(err)
	}
	if !delta.Delta || len(delta.Deleted) != 1 || delta.Deleted[0].ID != task.ID || len(delta.Rows) < 3 {
		t.Fatalf("incomplete delete delta: %s", recorder.Body.String())
	}
	replay := httptest.NewRecorder()
	replayRequest := httptest.NewRequest(http.MethodDelete, "/tasks/task_delete_test?workspace_id=workspace_test", nil)
	replayRequest.Header.Set("Idempotency-Key", "delete-task-test")
	api.deleteBusinessResource(replay, replayRequest, ownerAuth(), domainResourceByEntity("task"), task.ID)
	if replay.Code != recorder.Code || replay.Body.String() != recorder.Body.String() || replay.Header().Get("X-TimeManage-Idempotency-Replayed") != "true" {
		t.Fatalf("idempotent replay differs: status=%d body=%s", replay.Code, replay.Body.String())
	}
	if _, found, err := businessExistingRow(context.Background(), api.db, task.WorkspaceID, task.Entity, task.ID); err != nil || found {
		t.Fatalf("deleted task found=%v err=%v", found, err)
	}
	storedPlan, found, err := businessExistingRow(context.Background(), api.db, plan.WorkspaceID, plan.Entity, plan.ID)
	if err != nil || !found {
		t.Fatalf("load plan found=%v err=%v", found, err)
	}
	if len(stringSliceField(storedPlan.Payload, "committedTaskIds")) != 0 || len(stringSliceField(storedPlan.Payload, "suggestedTaskIds")) != 0 {
		t.Fatalf("task references remain in plan: %s", storedPlan.Payload)
	}
	storedWork, _, _ := businessExistingRow(context.Background(), api.db, work.WorkspaceID, work.Entity, work.ID)
	storedFocus, _, _ := businessExistingRow(context.Background(), api.db, focus.WorkspaceID, focus.Entity, focus.ID)
	if stringField(storedWork.Payload, "status") != "ended" || stringField(storedWork.Payload, "outcome") != "task_deleted" {
		t.Fatalf("work session not ended: %s", storedWork.Payload)
	}
	if stringField(storedFocus.Payload, "outcome") != "task_deleted" {
		t.Fatalf("focus session not ended: %s", storedFocus.Payload)
	}
}

func domainResourceByEntity(entity string) domainResourceSpec {
	for _, spec := range domainResourceSpecs {
		if spec.entity == entity {
			return spec
		}
	}
	return domainResourceSpec{}
}
