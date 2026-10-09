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

func TestQueueAdditionLocksTaskBeforeDailyPlan(t *testing.T) {
	api := mysqlSeededApp(t)
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	now := "2026-10-09T08:00:00Z"
	taskID, planID := "task_lock_order", "plan_lock_order"
	rows := []businessRow{}
	for _, item := range []struct {
		entity, id string
		payload    map[string]any
	}{
		{"project", "project_lock_order", map[string]any{"name": "Lock order"}},
		{"task", taskID, map[string]any{"projectId": "project_lock_order", "title": "Queue task", "status": "pool"}},
		{"daily_plan", planID, map[string]any{"ownerAccountId": "account_owner", "date": "2026-10-09", "committedTaskIds": []string{}}},
	} {
		item.payload["id"], item.payload["workspaceId"] = item.id, "workspace_test"
		item.payload["createdAt"], item.payload["updatedAt"] = now, now
		raw, _ := json.Marshal(item.payload)
		rows = append(rows, businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: item.entity, ID: item.id, UpdatedAt: now, Payload: raw})
	}
	saveRows(t, api, ownerAuth(), "", rows)

	timerTx, err := api.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer timerTx.Rollback()
	if _, found, err := businessExistingRowForUpdate(ctx, timerTx, "workspace_test", "task", taskID); err != nil || !found {
		t.Fatalf("timer task found=%v err=%v", found, err)
	}

	recorder := httptest.NewRecorder()
	done := make(chan struct{})
	go func() {
		defer close(done)
		request := httptest.NewRequest(http.MethodPost, "/daily-plans/"+planID+"/add-task", strings.NewReader(`{"workspace_id":"workspace_test","task_id":"task_lock_order"}`)).WithContext(ctx)
		api.handleDailyPlanAction(recorder, request, ownerAuth(), planID, "add-task")
	}()
	defer func() { _ = timerTx.Rollback(); <-done }()

	waiting := false
	for deadline := time.Now().Add(2 * time.Second); time.Now().Before(deadline); {
		var count int
		select {
		case <-done:
			t.Fatalf("queue returned before waiting: %d %s", recorder.Code, recorder.Body.String())
		default:
		}
		if err := api.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM performance_schema.data_lock_waits`).Scan(&count); err != nil {
			t.Fatal(err)
		}
		if count > 0 {
			waiting = true
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if !waiting {
		t.Fatal("queue request did not wait on the task lock")
	}
	// A queued add must not hold the plan while waiting for the timer's task.
	if _, _, err := businessExistingRowForUpdate(ctx, timerTx, "workspace_test", "daily_plan", planID); err != nil {
		t.Fatalf("queue and timer used opposite lock orders: %v", err)
	}
	if err := timerTx.Commit(); err != nil {
		t.Fatal(err)
	}
	<-done
	if recorder.Code != http.StatusOK {
		t.Fatalf("queue status = %d: %s", recorder.Code, recorder.Body.String())
	}
}
