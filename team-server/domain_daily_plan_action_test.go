package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDailyPlanAddTaskReturnsOnlyChangedRowsAndHandlesRetry(t *testing.T) {
	api := mysqlSeededApp(t)
	now := "2026-08-19T03:00:00Z"
	project := businessRow{
		WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project", ID: "project_queue_test", UpdatedAt: now,
		Payload: json.RawMessage(`{"id":"project_queue_test","workspaceId":"workspace_test","name":"Queue test","createdAt":"2026-08-19T03:00:00Z","updatedAt":"2026-08-19T03:00:00Z"}`),
	}
	member := businessRow{
		WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project_member", ID: "member_queue_test", UpdatedAt: now,
		Payload: json.RawMessage(`{"id":"member_queue_test","workspaceId":"workspace_test","projectId":"project_queue_test","accountId":"account_owner","name":"Owner","roles":["executor","project_owner"],"status":"active","createdAt":"2026-08-19T03:00:00Z","updatedAt":"2026-08-19T03:00:00Z"}`),
	}
	task := businessRow{
		WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "task", ID: "task_queue_test", UpdatedAt: now,
		Payload: json.RawMessage(`{"id":"task_queue_test","workspaceId":"workspace_test","projectId":"project_queue_test","title":"Queue me","status":"pool","createdAt":"2026-08-19T03:00:00Z","updatedAt":"2026-08-19T03:00:00Z"}`),
	}
	saveRows(t, api, ownerAuth(), "", []businessRow{project, member, task})
	planID := "plan_account_owner_workspace_test_2026-08-19"
	path := "/daily-plans/" + planID + "/add-task?workspace_id=workspace_test"
	body := `{"workspace_id":"workspace_test","task_id":"task_queue_test","date":"2026-08-19"}`

	request := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	request.Header.Set("Idempotency-Key", "daily-plan:add-task:"+planID+":"+task.ID)
	recorder := httptest.NewRecorder()
	api.handleDailyPlanAction(recorder, request, ownerAuth(), planID, "add-task")
	assertDailyPlanDelta(t, recorder, planID, task.ID)

	storedPlan, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "daily_plan", planID)
	if err != nil || !found {
		t.Fatalf("load plan found=%v err=%v", found, err)
	}
	if ids := stringSliceField(storedPlan.Payload, "committedTaskIds"); len(ids) != 1 || ids[0] != task.ID {
		t.Fatalf("committed task ids = %#v", ids)
	}
	storedTask, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "task", task.ID)
	if err != nil || !found || stringField(storedTask.Payload, "status") != "committed" {
		t.Fatalf("stored task found=%v err=%v payload=%s", found, err, storedTask.Payload)
	}

	retryRequest := httptest.NewRequest(http.MethodPost, path, strings.NewReader(body))
	retryRequest.Header.Set("Idempotency-Key", "daily-plan:add-task:"+planID+":"+task.ID)
	retryRecorder := httptest.NewRecorder()
	api.handleDailyPlanAction(retryRecorder, retryRequest, ownerAuth(), planID, "add-task")
	assertDailyPlanDelta(t, retryRecorder, planID, task.ID)
}

func assertDailyPlanDelta(t *testing.T, recorder *httptest.ResponseRecorder, planID string, taskID string) {
	t.Helper()
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}
	var response teamDataResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if !response.Delta {
		t.Fatalf("delta = false, body = %s", recorder.Body.String())
	}
	if len(response.Rows) != 2 {
		t.Fatalf("rows = %d, want 2: %s", len(response.Rows), recorder.Body.String())
	}
	seen := map[string]bool{}
	for _, row := range response.Rows {
		seen[row.Entity+"/"+row.ID] = true
	}
	if !seen["daily_plan/"+planID] || !seen["task/"+taskID] {
		t.Fatalf("changed rows = %#v", seen)
	}
}
