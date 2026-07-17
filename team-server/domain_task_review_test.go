package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTaskReviewAllowsExecutorSubmissionAndRequiresReviewerForDecision(t *testing.T) {
	api := mysqlSeededApp(t)
	now := "2026-07-17T08:00:00Z"
	executorAccount := accountRecord{
		ID: "account_executor", WorkspaceID: "workspace_test", Name: "Executor", Email: "executor@example.test",
		PasswordHash: "hash", CreatedAt: now, UpdatedAt: now,
	}
	tx, err := api.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := mysqlUpsertAccount(context.Background(), tx, executorAccount); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, "workspace_test", executorAccount.ID, "member", "active", now); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	project := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project", ID: "project_review_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"project_review_test","workspaceId":"workspace_test","name":"Review test","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	ownerMember := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project_member", ID: "member_review_owner", UpdatedAt: now, Payload: json.RawMessage(`{"id":"member_review_owner","workspaceId":"workspace_test","projectId":"project_review_test","accountId":"account_owner","name":"Owner","roles":["project_owner"],"status":"active","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	executorMember := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project_member", ID: "member_review_executor", UpdatedAt: now, Payload: json.RawMessage(`{"id":"member_review_executor","workspaceId":"workspace_test","projectId":"project_review_test","accountId":"account_executor","name":"Executor","roles":["executor"],"status":"active","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	task := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "task", ID: "task_review_test", UpdatedAt: now, Payload: json.RawMessage(`{"id":"task_review_test","workspaceId":"workspace_test","projectId":"project_review_test","title":"Submit me","status":"in_progress","progressPercent":40,"primaryExecutorMemberId":"member_review_executor","repeatRule":"after_completion","repeatIntervalDays":2,"dueAt":"2026-07-17T09:00:00Z","createdAt":"2026-07-17T08:00:00Z","updatedAt":"2026-07-17T08:00:00Z"}`)}
	saveRows(t, api, ownerAuth(), "", []businessRow{project, ownerMember, executorMember, task})

	executorAuth := authContext{AccountID: executorAccount.ID, WorkspaceID: "workspace_test"}
	submitRecorder := httptest.NewRecorder()
	api.handleTaskAction(submitRecorder, httptest.NewRequest(http.MethodPost, "/tasks/task_review_test/submit-review?workspace_id=workspace_test", strings.NewReader(`{"workspace_id":"workspace_test"}`)), executorAuth, task.ID, "submit-review")
	if submitRecorder.Code != http.StatusOK {
		t.Fatalf("executor submit status = %d, body = %s", submitRecorder.Code, submitRecorder.Body.String())
	}
	submitted, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "task", task.ID)
	if err != nil || !found {
		t.Fatalf("load submitted task: found=%v err=%v", found, err)
	}
	submittedPayload, _ := rowPayloadObject(submitted)
	if status := stringField(submitted.Payload, "status"); status != "pending_review" {
		t.Fatalf("submitted status = %q", status)
	}
	if submittedPayload["reviewSubmittedByMemberId"] != executorMember.ID || numericInt(submittedPayload["progressPercent"]) != 100 {
		t.Fatalf("submitted payload = %#v", submittedPayload)
	}

	deniedRecorder := httptest.NewRecorder()
	api.handleTaskAction(deniedRecorder, httptest.NewRequest(http.MethodPost, "/tasks/task_review_test/accept-review?workspace_id=workspace_test", strings.NewReader(`{"workspace_id":"workspace_test"}`)), executorAuth, task.ID, "accept-review")
	if deniedRecorder.Code != http.StatusForbidden {
		t.Fatalf("executor accept status = %d, want %d", deniedRecorder.Code, http.StatusForbidden)
	}

	acceptRecorder := httptest.NewRecorder()
	acceptRequest := httptest.NewRequest(http.MethodPost, "/tasks/task_review_test/accept-review?workspace_id=workspace_test", strings.NewReader(`{"workspace_id":"workspace_test"}`))
	acceptRequest.Header.Set("Idempotency-Key", "accept-review:task_review_test")
	api.handleTaskAction(acceptRecorder, acceptRequest, ownerAuth(), task.ID, "accept-review")
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("owner accept status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}
	accepted, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "task", task.ID)
	acceptedPayload, _ := rowPayloadObject(accepted)
	if stringField(accepted.Payload, "status") != "completed" || acceptedPayload["reviewAcceptedByMemberId"] != ownerMember.ID || acceptedPayload["completedAt"] == nil {
		t.Fatalf("accepted payload = %#v", acceptedPayload)
	}
	var taskCount int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM business_tasks WHERE workspace_id = ? AND project_id = ?`, "workspace_test", project.ID).Scan(&taskCount); err != nil {
		t.Fatal(err)
	}
	if taskCount != 2 {
		t.Fatalf("task count after recurring acceptance = %d, want 2", taskCount)
	}
	retryRecorder := httptest.NewRecorder()
	retryRequest := httptest.NewRequest(http.MethodPost, "/tasks/task_review_test/accept-review?workspace_id=workspace_test", strings.NewReader(`{"workspace_id":"workspace_test"}`))
	retryRequest.Header.Set("Idempotency-Key", "accept-review:task_review_test")
	api.handleTaskAction(retryRecorder, retryRequest, ownerAuth(), task.ID, "accept-review")
	if retryRecorder.Code != http.StatusOK {
		t.Fatalf("idempotent accept retry status = %d, body = %s", retryRecorder.Code, retryRecorder.Body.String())
	}
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM business_tasks WHERE workspace_id = ? AND project_id = ?`, "workspace_test", project.ID).Scan(&taskCount); err != nil {
		t.Fatal(err)
	}
	if taskCount != 2 {
		t.Fatalf("task count after idempotent retry = %d, want 2", taskCount)
	}
	var nextPayloadRaw []byte
	if err := api.db.QueryRow(`SELECT payload FROM business_tasks WHERE workspace_id = ? AND project_id = ? AND id <> ?`, "workspace_test", project.ID, task.ID).Scan(&nextPayloadRaw); err != nil {
		t.Fatal(err)
	}
	var nextPayload map[string]any
	if err := json.Unmarshal(nextPayloadRaw, &nextPayload); err != nil {
		t.Fatal(err)
	}
	if nextPayload["status"] != "pool" || nextPayload["recurrenceParentId"] != task.ID || stringField(json.RawMessage(nextPayloadRaw), "dueAt")[:10] != "2026-07-19" {
		t.Fatalf("next recurring payload = %#v", nextPayload)
	}
}
