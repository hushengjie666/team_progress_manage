package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func projectDeletionFixture(t *testing.T) (*app, []businessRow) {
	t.Helper()
	api := mysqlSeededApp(t)
	row := func(entity, id string, fields map[string]any) businessRow {
		fields["id"], fields["workspaceId"] = id, "workspace_test"
		fields["createdAt"], fields["updatedAt"] = "2026-10-21T08:00:00Z", "2026-10-21T08:00:00Z"
		raw, err := json.Marshal(fields)
		if err != nil {
			t.Fatal(err)
		}
		return businessRow{WorkspaceID: "workspace_test", AccountID: "account_owner", Entity: entity, ID: id, UpdatedAt: "2026-10-21T08:00:00Z", Payload: raw}
	}
	rows := []businessRow{
		row("project", "project_remove", map[string]any{"name": "Remove me"}),
		row("project", "project_keep", map[string]any{"name": "Keep me"}),
		row("project_member", "member_remove", map[string]any{"projectId": "project_remove", "accountId": "account_owner", "name": "Owner", "roles": []string{"project_owner", "executor"}, "status": "active"}),
		row("task", "task_remove", map[string]any{"projectId": "project_remove", "title": "Remove task", "status": "in_progress"}),
		row("task", "task_completed", map[string]any{"projectId": "project_remove", "title": "Completed task", "status": "completed"}),
		row("task", "task_keep", map[string]any{"projectId": "project_keep", "title": "Keep task", "status": "committed"}),
		row("daily_plan", "plan_mixed", map[string]any{"ownerAccountId": "account_owner", "date": "2026-10-21", "committedTaskIds": []string{"task_remove", "task_keep", "task_completed"}, "suggestedTaskIds": []string{"task_keep", "task_remove"}}),
		row("focus_session", "focus_remove", map[string]any{"mode": "focus", "duration": 1500}),
		row("work_session", "work_remove", map[string]any{"taskId": "task_remove", "focusSessionId": "focus_remove", "status": "active"}),
		row("execution_signal", "signal_remove", map[string]any{"workSessionId": "work_remove", "type": "work_started"}),
		row("interruption", "interruption_remove", map[string]any{"sessionId": "focus_remove", "type": "internal", "action": "defer"}),
		row("template_instance", "instance_remove", map[string]any{"templateId": "template_keep", "taskId": "task_remove"}),
		row("task_template", "template_keep", map[string]any{"name": "Reusable template"}),
	}
	saveRows(t, api, ownerAuth(), "", rows)
	if _, err := api.db.Exec(`INSERT INTO project_invitations (id, workspace_id, project_id, inviter_account_id, invitee_account_id, invitee_email, roles_json, status, created_at, updated_at) VALUES ('invite_remove','workspace_test','project_remove','account_owner','account_owner','owner@test.local','["executor"]','pending','now','now')`); err != nil {
		t.Fatal(err)
	}
	return api, rows
}

func deleteProjectRequest(api *app, auth authContext) *httptest.ResponseRecorder {
	recorder := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodDelete, "/projects/project_remove?workspace_id=workspace_test", nil)
	request.Header.Set("Idempotency-Key", "delete-project-test")
	api.deleteBusinessResource(recorder, request, auth, domainResourceByEntity("project"), "project_remove")
	return recorder
}

func TestDeletingProjectCleansDependentsAndKeepsOtherProjects(t *testing.T) {
	api, rows := projectDeletionFixture(t)
	recorder := deleteProjectRequest(api, ownerAuth())
	if recorder.Code != http.StatusOK {
		t.Fatalf("delete status=%d body=%s", recorder.Code, recorder.Body.String())
	}
	var delta mutationDeltaResponse
	if err := json.Unmarshal(recorder.Body.Bytes(), &delta); err != nil {
		t.Fatal(err)
	}
	deleted := map[string]bool{}
	for _, item := range delta.Deleted {
		deleted[item.ID] = true
	}
	keep := map[string]bool{"project_keep": true, "task_keep": true, "plan_mixed": true, "template_keep": true}
	for _, row := range rows {
		_, found, err := businessExistingRow(context.Background(), api.db, row.WorkspaceID, row.Entity, row.ID)
		if err != nil || found != keep[row.ID] || deleted[row.ID] == keep[row.ID] {
			t.Fatalf("%s: found=%v deleted=%v err=%v", row.ID, found, deleted[row.ID], err)
		}
	}
	plan, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "daily_plan", "plan_mixed")
	var invitations int
	if err := api.db.QueryRow(`SELECT COUNT(*) FROM project_invitations WHERE id='invite_remove'`).Scan(&invitations); err != nil || invitations != 0 {
		t.Fatalf("project invitations remain=%d err=%v", invitations, err)
	}
	for _, field := range []string{"committedTaskIds", "suggestedTaskIds"} {
		if !reflect.DeepEqual(stringSliceField(plan.Payload, field), []string{"task_keep"}) {
			t.Fatalf("%s references=%v", field, stringSliceField(plan.Payload, field))
		}
	}
	replay := deleteProjectRequest(api, ownerAuth())
	if replay.Code != http.StatusOK || replay.Header().Get("X-TimeManage-Idempotency-Replayed") != "true" {
		t.Fatalf("delete retry=%d %s", replay.Code, replay.Body.String())
	}
	create := httptest.NewRecorder()
	api.createBusinessResource(create, httptest.NewRequest(http.MethodPost, "/tasks?workspace_id=workspace_test", strings.NewReader(`{"id":"task_late","projectId":"project_remove","title":"Late task"}`)), ownerAuth(), domainResourceByEntity("task"))
	if create.Code != http.StatusConflict {
		t.Fatalf("late task creation=%d %s", create.Code, create.Body.String())
	}
	patch := httptest.NewRecorder()
	api.patchBusinessResource(patch, httptest.NewRequest(http.MethodPatch, "/tasks/task_keep?workspace_id=workspace_test", strings.NewReader(`{"projectId":"project_remove"}`)), ownerAuth(), domainResourceByEntity("task"), "task_keep")
	if patch.Code != http.StatusConflict {
		t.Fatalf("move to deleted project=%d %s", patch.Code, patch.Body.String())
	}
	kept, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "task", "task_keep")
	if businessProjectID(kept) != "project_keep" {
		t.Fatal("failed reassignment changed the kept task")
	}
}

func TestDeletingProjectRequiresManagementPermission(t *testing.T) {
	api, _ := projectDeletionFixture(t)
	tx, err := api.db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	defer tx.Rollback()
	account := accountRecord{ID: "account_executor", WorkspaceID: "workspace_test", Name: "Executor", Email: "executor@test.local", PasswordHash: "hash", CreatedAt: "now", UpdatedAt: "now"}
	if err := mysqlUpsertAccount(context.Background(), tx, account); err != nil {
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, "workspace_test", account.ID, "member", "active", "now"); err != nil {
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	recorder := deleteProjectRequest(api, authContext{WorkspaceID: "workspace_test", AccountID: account.ID})
	if recorder.Code != http.StatusForbidden {
		t.Fatalf("unauthorized delete=%d %s", recorder.Code, recorder.Body.String())
	}
	if _, found, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "project", "project_remove"); !found {
		t.Fatal("unauthorized request removed project")
	}
}

func TestDeletingProjectRollsBackAllCleanupOnFailure(t *testing.T) {
	api, _ := projectDeletionFixture(t)
	_, err := api.db.Exec(`CREATE TRIGGER reject_project_deletion BEFORE DELETE ON business_tasks FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'test delete failure'`)
	if err != nil {
		t.Fatal(err)
	}
	recorder := deleteProjectRequest(api, ownerAuth())
	if recorder.Code != http.StatusInternalServerError {
		t.Fatalf("failed delete=%d %s", recorder.Code, recorder.Body.String())
	}
	for _, key := range []struct{ entity, id string }{{"project", "project_remove"}, {"task", "task_remove"}, {"work_session", "work_remove"}, {"focus_session", "focus_remove"}} {
		row, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", key.entity, key.id)
		if err != nil || !found {
			t.Fatalf("rollback lost %s: %v", key.id, err)
		}
		if key.entity == "work_session" && stringField(row.Payload, "status") != "active" {
			t.Fatal("rollback did not restore active work session")
		}
	}
	plan, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "daily_plan", "plan_mixed")
	if len(stringSliceField(plan.Payload, "committedTaskIds")) != 3 {
		t.Fatal("failed deletion changed daily plan")
	}
}
