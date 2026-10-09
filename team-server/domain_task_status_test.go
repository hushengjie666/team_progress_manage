package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestTaskStatusSurvivesLateStartAndFocusCompletion(t *testing.T) {
	api := mysqlSeededApp(t)
	ctx := context.Background()
	now := "2026-10-09T08:00:00Z"
	project := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "project", ID: "project_status_test", UpdatedAt: now,
		Payload: json.RawMessage(`{"id":"project_status_test","workspaceId":"workspace_test","name":"Status test","createdAt":"2026-10-09T08:00:00Z","updatedAt":"2026-10-09T08:00:00Z"}`)}
	saveRows(t, api, ownerAuth(), "", []businessRow{project})
	for _, status := range []string{"pending_review", "completed", "split", "archived"} {
		t.Run(status, func(t *testing.T) {
			taskID := "task_status_" + status
			raw, _ := json.Marshal(map[string]any{"id": taskID, "workspaceId": "workspace_test", "projectId": project.ID, "title": "Keep status", "status": status, "actualPomodoros": 2, "createdAt": now, "updatedAt": now})
			task := businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: "task", ID: taskID, UpdatedAt: now, Payload: raw}
			saveRows(t, api, ownerAuth(), "", []businessRow{task})

			recorder := httptest.NewRecorder()
			api.handleTaskAction(recorder, httptest.NewRequest(http.MethodPost, "/tasks/"+taskID+"/start", strings.NewReader(`{"workspace_id":"workspace_test"}`)), ownerAuth(), taskID, "start")
			if recorder.Code != http.StatusConflict {
				t.Fatalf("late start status = %d, want 409: %s", recorder.Code, recorder.Body.String())
			}

			tx, err := api.db.BeginTx(ctx, nil)
			if err != nil {
				t.Fatal(err)
			}
			defer tx.Rollback()
			if err := completeFocusedTaskInTx(ctx, tx, ownerAuth(), "workspace_test", map[string]any{"taskId": taskID}, "2026-10-09T08:25:00Z"); err != nil {
				t.Fatal(err)
			}
			if err := tx.Commit(); err != nil {
				t.Fatal(err)
			}
			stored, found, err := businessExistingRow(ctx, api.db, "workspace_test", "task", taskID)
			if err != nil || !found {
				t.Fatalf("load task: found=%v err=%v", found, err)
			}
			payload, _ := rowPayloadObject(stored)
			if payload["status"] != status || numericInt(payload["actualPomodoros"]) != 3 {
				t.Fatalf("late completion changed task incorrectly: %#v", payload)
			}
		})
	}
}
