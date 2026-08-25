package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"
)

func TestTaskStartReturnsAndCreatesSingleWorkSession(t *testing.T) {
	api := mysqlSeededApp(t)
	now := "2026-07-17T02:00:00Z"
	project := businessRow{
		WorkspaceID: "workspace_test",
		AccountID:   "account_owner",
		Entity:      "project",
		ID:          "project_start_test",
		UpdatedAt:   now,
		Payload:     json.RawMessage(`{"id":"project_start_test","workspaceId":"workspace_test","name":"Start test","createdAt":"2026-07-17T02:00:00Z","updatedAt":"2026-07-17T02:00:00Z"}`),
	}
	projectMember := businessRow{
		WorkspaceID: "workspace_test",
		AccountID:   "account_owner",
		Entity:      "project_member",
		ID:          "member_start_test",
		UpdatedAt:   now,
		Payload:     json.RawMessage(`{"id":"member_start_test","workspaceId":"workspace_test","projectId":"project_start_test","accountId":"account_owner","name":"Owner","roles":["executor","project_owner"],"createdAt":"2026-07-17T02:00:00Z","updatedAt":"2026-07-17T02:00:00Z"}`),
	}
	dailyPlan := businessRow{
		WorkspaceID: "workspace_test",
		AccountID:   "account_owner",
		Entity:      "daily_plan",
		ID:          "plan_account_owner_workspace_test_2026-07-17",
		UpdatedAt:   now,
		Payload:     json.RawMessage(`{"id":"plan_account_owner_workspace_test_2026-07-17","workspaceId":"workspace_test","ownerAccountId":"account_owner","date":"2026-07-17","capacityPomodoros":8,"committedTaskIds":["task_start_test"],"completedPomodoros":0,"suggestedTaskIds":[],"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-07-17T02:00:00Z","updatedAt":"2026-07-17T02:00:00Z"}`),
	}
	task := businessRow{
		WorkspaceID: "workspace_test",
		AccountID:   "account_owner",
		Entity:      "task",
		ID:          "task_start_test",
		UpdatedAt:   now,
		Payload:     json.RawMessage(`{"id":"task_start_test","workspaceId":"workspace_test","projectId":"project_start_test","title":"Start me","status":"committed","primaryExecutorMemberId":"member_start_test","createdAt":"2026-07-17T02:00:00Z","updatedAt":"2026-07-17T02:00:00Z"}`),
	}
	saveRows(t, api, ownerAuth(), "", []businessRow{project, projectMember, task, dailyPlan})

	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	req := httptest.NewRequest(http.MethodPost, "/tasks/task_start_test/start?workspace_id=workspace_test", strings.NewReader(`{"workspace_id":"workspace_test"}`)).WithContext(ctx)
	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		api.handleTaskAction(recorder, req, ownerAuth(), task.ID, "start")
		close(done)
	}()
	select {
	case <-done:
	case <-ctx.Done():
		t.Fatal("task start did not return before request timeout")
	}
	if recorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", recorder.Code, recorder.Body.String())
	}

	for table, expected := range map[string]int{
		"business_daily_plans":       1,
		"business_focus_sessions":    1,
		"business_work_sessions":     1,
		"business_execution_signals": 1,
	} {
		var count int
		if err := api.db.QueryRow(`SELECT COUNT(*) FROM `+table+` WHERE workspace_id = ?`, "workspace_test").Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count != expected {
			t.Fatalf("%s count = %d, want %d", table, count, expected)
		}
	}

	secondStartRequest := httptest.NewRequest(
		http.MethodPost,
		"/tasks/task_start_test/start?workspace_id=workspace_test",
		strings.NewReader(`{"workspace_id":"workspace_test","focus_session_id":"focus_start_second","work_session_id":"work_start_second"}`),
	)
	secondStartRecorder := httptest.NewRecorder()
	api.handleTaskAction(secondStartRecorder, secondStartRequest, ownerAuth(), task.ID, "start")
	if secondStartRecorder.Code != http.StatusOK {
		t.Fatalf("second start status = %d, body = %s", secondStartRecorder.Code, secondStartRecorder.Body.String())
	}

	var activeWorkSessionCount int
	if err := api.db.QueryRow(
		`SELECT COUNT(*) FROM business_work_sessions WHERE account_id = ? AND status IN ('active', 'paused')`,
		"account_owner",
	).Scan(&activeWorkSessionCount); err != nil {
		t.Fatal(err)
	}
	if activeWorkSessionCount != 1 {
		t.Fatalf("active work session count = %d, want 1", activeWorkSessionCount)
	}
	var supersededWorkSessionCount int
	if err := api.db.QueryRow(
		`SELECT COUNT(*) FROM business_work_sessions WHERE account_id = ? AND status = 'ended' AND JSON_UNQUOTE(JSON_EXTRACT(payload, '$.outcome')) = 'superseded'`,
		"account_owner",
	).Scan(&supersededWorkSessionCount); err != nil {
		t.Fatal(err)
	}
	if supersededWorkSessionCount != 1 {
		t.Fatalf("superseded work session count = %d, want 1", supersededWorkSessionCount)
	}

	var workSessionID string
	if err := api.db.QueryRow(`SELECT id FROM business_work_sessions WHERE workspace_id = ? AND status = 'active'`, "workspace_test").Scan(&workSessionID); err != nil {
		t.Fatal(err)
	}
	legacySession := businessRow{
		WorkspaceID: "workspace_test",
		AccountID:   "account_owner",
		Entity:      "work_session",
		ID:          "work_legacy_duplicate",
		UpdatedAt:   now,
		Payload:     json.RawMessage(`{"id":"work_legacy_duplicate","workspaceId":"workspace_test","taskId":"task_start_test","focusSessionId":"focus_missing_legacy","status":"active","startedAt":"2026-07-17T01:50:00Z","totalPausedSeconds":0,"createdAt":"2026-07-17T01:50:00Z","updatedAt":"2026-07-17T01:50:00Z"}`),
	}
	saveRows(t, api, ownerAuth(), "", []businessRow{legacySession})
	finishRequest := httptest.NewRequest(
		http.MethodPost,
		"/work-sessions/"+workSessionID+"/finish?workspace_id=workspace_test",
		strings.NewReader(`{"workspace_id":"workspace_test","outcome":"completed"}`),
	)
	finishRecorder := httptest.NewRecorder()
	api.handleWorkSessionAction(finishRecorder, finishRequest, ownerAuth(), workSessionID, "finish")
	if finishRecorder.Code != http.StatusOK {
		t.Fatalf("finish status = %d, body = %s", finishRecorder.Code, finishRecorder.Body.String())
	}
	if err := api.db.QueryRow(
		`SELECT COUNT(*) FROM business_work_sessions WHERE account_id = ? AND status IN ('active', 'paused')`,
		"account_owner",
	).Scan(&activeWorkSessionCount); err != nil {
		t.Fatal(err)
	}
	if activeWorkSessionCount != 0 {
		t.Fatalf("active work session count after finish = %d, want 0", activeWorkSessionCount)
	}

	completedTask, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "task", task.ID)
	if err != nil || !found {
		t.Fatalf("load completed task: found=%v err=%v", found, err)
	}
	completedTaskPayload, err := rowPayloadObject(completedTask)
	if err != nil {
		t.Fatal(err)
	}
	if actual := numericInt(completedTaskPayload["actualPomodoros"]); actual != 1 {
		t.Fatalf("actualPomodoros = %d, want 1", actual)
	}

	completedPlan, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "daily_plan", dailyPlan.ID)
	if err != nil || !found {
		t.Fatalf("load completed plan: found=%v err=%v", found, err)
	}
	completedPlanPayload, err := rowPayloadObject(completedPlan)
	if err != nil {
		t.Fatal(err)
	}
	if actual := numericInt(completedPlanPayload["completedPomodoros"]); actual != 1 {
		t.Fatalf("completedPomodoros = %d, want 1", actual)
	}

	var completedFocusCount int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM business_focus_sessions WHERE workspace_id = ? AND status = ?`, "workspace_test", "completed").Scan(&completedFocusCount); err != nil {
		t.Fatal(err)
	}
	if completedFocusCount != 1 {
		t.Fatalf("completed focus sessions = %d, want 1", completedFocusCount)
	}
}
