package main

import (
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"
)

func TestDailyTaskCheckInAndRemovalRoundTrip(t *testing.T) {
	api := mysqlSeededApp(t)
	rows := relationalFixtureRows()
	var task businessRow
	for i, row := range rows {
		if row.Entity == "task" {
			task = row
			task.Payload, _ = applyBusinessMergePatch(row.Payload, []byte(`{"isDaily":true,"repeatRule":"daily"}`))
			rows[i] = task
		}
	}
	saveRows(t, api, ownerAuth(), "", rows[:3])
	load := func(entity, id string) businessRow {
		row, found, err := businessExistingRow(t.Context(), api.db, task.WorkspaceID, entity, id)
		if err != nil || !found {
			t.Fatalf("load %s/%s: found=%t err=%v", entity, id, found, err)
		}
		return row
	}
	post := func(action, body string, want int) {
		t.Helper()
		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodPost, "/tasks/"+task.ID+"/"+action, strings.NewReader(body))
		api.handleTaskAction(rr, req, ownerAuth(), task.ID, action)
		if rr.Code != want {
			t.Fatalf("%s: %d %s", action, rr.Code, rr.Body.String())
		}
	}
	day1 := `{"date":"2026-11-28","work_session_id":"work_daily","focus_session_id":"focus_daily","duration":1500}`
	day2 := `{"date":"2026-11-29"}`
	post("start", day1, 200)
	post("submit-review", day1, 200)
	post("submit-review", day1, 200)
	post("start", day1, 409)
	if stringField(load("work_session", "work_daily").Payload, "status") != "ended" || stringField(load("focus_session", "focus_daily").Payload, "endedAt") == "" {
		t.Fatal("active session did not close")
	}
	planID := "plan_account_owner_workspace_test_2026-11-29"
	rr := httptest.NewRecorder()
	req := httptest.NewRequest("POST", "/daily-plans/"+planID+"/remove-task", strings.NewReader(`{"task_id":"task_core","date":"2026-11-29"}`))
	api.handleDailyPlanAction(rr, req, ownerAuth(), planID, "remove-task")
	if rr.Code != 200 {
		t.Fatalf("remove: %s", rr.Body.String())
	}
	removed, _ := rowPayloadObject(load("task", task.ID))
	if !reflect.DeepEqual(removed["dailyRemovedDates"], map[string]any{"account_owner": "2026-11-29"}) {
		t.Fatal("removal did not round-trip")
	}
	for _, toggle := range []string{`{"isDaily":false}`, `{"isDaily":true}`} {
		rr := httptest.NewRecorder()
		api.handleBusinessResource(rr, httptest.NewRequest("PATCH", "/tasks/"+task.ID, strings.NewReader(toggle)), ownerAuth(), domainResourceByEntity("task"))
		if rr.Code != 200 {
			t.Fatalf("toggle: %s", rr.Body.String())
		}
	}
	reset, _ := rowPayloadObject(load("task", task.ID))
	if dates, _ := reset["dailyRemovedDates"].(map[string]any); dates["account_owner"] != nil {
		t.Fatal("re-enabling did not restore today")
	}
	post("start", day2, 200)
	post("submit-review", day2, 200)
	got := load("task", task.ID)
	payload, _ := rowPayloadObject(got)
	if payload["isDaily"] != true || !reflect.DeepEqual(stringSliceField(got.Payload, "dailyCompletedDates"), []string{"2026-11-28", "2026-11-29"}) {
		t.Fatalf("bad check-ins: %s", got.Payload)
	}
	var count int
	if err := api.db.QueryRow("SELECT COUNT(*) FROM business_tasks WHERE project_id=?", businessProjectID(task)).Scan(&count); err != nil || count != 1 {
		t.Fatalf("task count=%d err=%v", count, err)
	}
	rr = httptest.NewRecorder()
	api.deleteBusinessResource(rr, httptest.NewRequest("DELETE", "/tasks/"+task.ID, nil), ownerAuth(), domainResourceByEntity("task"), task.ID)
	if rr.Code != 200 {
		t.Fatalf("delete: %s", rr.Body.String())
	}
	if containsString(stringSliceField(load("daily_plan", planID).Payload, "committedTaskIds"), task.ID) {
		t.Fatal("deleted task still planned")
	}
}
