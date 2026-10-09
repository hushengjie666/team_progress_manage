package main

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func extendedDomainRequest(t *testing.T, api *app, method, path, body string) teamDataResponse {
	t.Helper()
	response := httptest.NewRecorder()
	request := httptest.NewRequest(method, path, strings.NewReader(body))
	for _, spec := range domainResourceSpecs {
		if strings.HasPrefix(request.URL.Path, "/"+spec.path+"/") {
			api.handleBusinessResource(response, request, ownerAuth(), spec)
			if response.Code != http.StatusOK {
				t.Fatalf("%s %s: status=%d body=%s", method, path, response.Code, response.Body.String())
			}
			var result teamDataResponse
			if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			return result
		}
	}
	t.Fatalf("unsupported test resource path %s", path)
	return teamDataResponse{}
}

func extendedFixtureApp(t *testing.T) *app {
	t.Helper()
	api := mysqlSeededApp(t)
	saveRows(t, api, ownerAuth(), "", relationalFixtureRows())
	return api
}

func TestTemplateInstantiationAndCollectionEditsPersistThroughBootstrap(t *testing.T) {
	api := extendedFixtureApp(t)
	extendedDomainRequest(t, api, http.MethodPatch, "/task-templates/template_core?workspace_id=workspace_test", `{"name":"Edited template","tags":["second","first","second"],"subtasks":["B","A"]}`)
	result := extendedDomainRequest(t, api, http.MethodPost, "/task-templates/template_core/instantiate", `{"workspace_id":"workspace_test","task":{"id":"task_from_template","projectId":"project_core","title":"Template task","status":"pool","stage":"planning","tags":["second","first","second"],"subtasks":[{"id":"sub_template_b","title":"B","completed":false},{"id":"sub_template_a","title":"A","completed":true}]}}`)
	if len(result.Rows) != 2 {
		t.Fatalf("instantiate delta rows=%d, want task and instance", len(result.Rows))
	}
	extendedDomainRequest(t, api, http.MethodPatch, "/tasks/task_from_template?workspace_id=workspace_test", `{"notes":"Saved details","progressPercent":37.5,"tags":["first","second"],"subtasks":[{"id":"sub_template_a","title":"A edited","completed":true},{"id":"sub_template_b","title":"B","completed":false}]}`)
	rows, err := api.businessRowsForAccount(context.Background(), ownerAuth())
	if err != nil {
		t.Fatal(err)
	}
	var task, template, instance businessRow
	for _, row := range rows {
		switch row.ID {
		case "task_from_template":
			task = row
		case "template_core":
			template = row
		case "template_core_task_from_template":
			instance = row
		}
	}
	if stringField(task.Payload, "notes") != "Saved details" || !containsString(stringSliceField(task.Payload, "tags"), "first") {
		t.Fatal("task edits missing from bootstrap")
	}
	var object map[string]any
	json.Unmarshal(task.Payload, &object)
	if object["progressPercent"] != 37.5 || object["subtasks"].([]any)[0].(map[string]any)["title"] != "A edited" {
		t.Fatal("ordered subtasks or progress lost")
	}
	tags := stringSliceField(template.Payload, "tags")
	if len(tags) != 3 || tags[0] != "second" || tags[2] != "second" {
		t.Fatal("template tag order or duplicates lost")
	}
	if stringField(instance.Payload, "taskId") != task.ID {
		t.Fatal("template instance missing")
	}
	extendedDomainRequest(t, api, http.MethodDelete, "/task-templates/template_core?workspace_id=workspace_test", "")
	var remaining int
	if err := api.db.QueryRow("SELECT COUNT(*) FROM task_template_tags WHERE parent_id='template_core'").Scan(&remaining); err != nil || remaining != 0 {
		t.Fatalf("deleted template retained detail rows: %d %v", remaining, err)
	}
}

func TestWorkPauseResumeResetAndCompletionPersistCoreState(t *testing.T) {
	api := extendedFixtureApp(t)
	extendedDomainRequest(t, api, http.MethodPost, "/tasks/task_core/start", `{"workspace_id":"workspace_test","focus_session_id":"focus_flow","work_session_id":"work_flow","duration":90}`)
	for _, action := range []string{"pause", "resume", "reset", "resume"} {
		extendedDomainRequest(t, api, http.MethodPost, "/work-sessions/work_flow/"+action, `{"workspace_id":"workspace_test"}`)
		work, found, err := businessExistingRow(context.Background(), api.db, "workspace_test", "work_session", "work_flow")
		if err != nil || !found {
			t.Fatal("work session missing", err)
		}
		expected := "paused"
		if action == "resume" {
			expected = "active"
		}
		if stringField(work.Payload, "status") != expected {
			t.Fatalf("%s state=%s", action, work.Payload)
		}
		if action == "resume" && (stringField(work.Payload, "resumedAt") == "" || stringField(work.Payload, "pausedAt") != "") {
			t.Fatal("resume timestamps incorrect")
		}
	}
	extendedDomainRequest(t, api, http.MethodPost, "/work-sessions/work_flow/finish", `{"workspace_id":"workspace_test","outcome":"completed"}`)
	work, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "work_session", "work_flow")
	focus, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "focus_session", "focus_flow")
	if stringField(work.Payload, "status") != "ended" || stringField(work.Payload, "outcome") != "completed" || stringField(focus.Payload, "outcome") != "completed" {
		t.Fatal("completion not persisted")
	}
	task, _, _ := businessExistingRow(context.Background(), api.db, "workspace_test", "task", "task_core")
	var payload map[string]any
	json.Unmarshal(task.Payload, &payload)
	if payload["actualPomodoros"] != float64(2) {
		t.Fatalf("completion count=%v", payload["actualPomodoros"])
	}
	var signals int
	if err := api.db.QueryRow("SELECT COUNT(*) FROM business_execution_signals WHERE task_id='task_core'").Scan(&signals); err != nil || signals < 6 {
		t.Fatalf("execution history=%d %v", signals, err)
	}
}

func TestProjectMovePreservesOrderedDetailsAndTaskDeletionCleansThem(t *testing.T) {
	api := extendedFixtureApp(t)
	ctx := context.Background()
	tx, err := api.db.BeginTx(ctx, nil)
	if err != nil {
		t.Fatal(err)
	}
	defer mysqlRollback(tx)
	now := "2026-10-09T00:00:00Z"
	workspace := workspaceData{ID: "workspace_target_core", Name: "Target", Type: "shared", OwnerAccountID: "account_owner", CreatedAt: now, UpdatedAt: now}
	if err = mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		t.Fatal(err)
	}
	if err = mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, "account_owner", "owner", "active", now); err != nil {
		t.Fatal(err)
	}
	if err = tx.Commit(); err != nil {
		t.Fatal(err)
	}
	extendedDomainRequest(t, api, http.MethodPost, "/projects/project_core/move", `{"workspace_id":"workspace_test","target_workspace_id":"workspace_target_core"}`)
	for _, entity := range []string{"project", "project_member", "task", "focus_session", "work_session", "execution_signal", "interruption"} {
		id := map[string]string{"project": "project_core", "project_member": "member_core", "task": "task_core", "focus_session": "focus_core", "work_session": "work_core", "execution_signal": "signal_core", "interruption": "interruption_core"}[entity]
		moved, found, e := businessExistingRow(ctx, api.db, workspace.ID, entity, id)
		if e != nil || !found {
			t.Fatalf("move %s: found=%v err=%v", entity, found, e)
		}
		if stringField(moved.Payload, "workspaceId") != workspace.ID {
			t.Fatalf("move %s workspace missing", entity)
		}
	}
	task, _, _ := businessExistingRow(ctx, api.db, workspace.ID, "task", "task_core")
	tags := stringSliceField(task.Payload, "tags")
	if len(tags) != 3 || tags[0] != "乙" || tags[1] != "甲" {
		t.Fatal("task details lost during move")
	}
	var sourceDetails int
	if err = api.db.QueryRow("SELECT COUNT(*) FROM task_subtasks WHERE workspace_id='workspace_test'").Scan(&sourceDetails); err != nil || sourceDetails != 0 {
		t.Fatalf("source details remain: %d %v", sourceDetails, err)
	}
	extendedDomainRequest(t, api, http.MethodDelete, "/tasks/task_core?workspace_id=workspace_target_core", "")
	for _, table := range []string{"task_tags", "task_subtasks", "task_collaborators", "task_repeat_weekdays", "task_estimate_history"} {
		var count int
		if err = api.db.QueryRow("SELECT COUNT(*) FROM " + table + " WHERE parent_id='task_core'").Scan(&count); err != nil || count != 0 {
			t.Fatalf("delete cascade %s: %d %v", table, count, err)
		}
	}
}
