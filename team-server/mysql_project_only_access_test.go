package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLTeamStateAllProjectOnlyAccess(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", defaultAdminLoginBody(t, "device_admin")))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	createSharedRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSharedRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"交付协作区","type":"shared"}`))), adminAuth)
	if createSharedRecorder.Code != http.StatusOK {
		t.Fatalf("create shared status = %d, body = %s", createSharedRecorder.Code, createSharedRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(createSharedRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: sharedLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	workspaceID := sharedLogin.Workspace.ID
	saveRows(t, api, sharedAuth, "device_seed", []businessRow{
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_visible", UpdatedAt: "2026-07-01T08:00:00Z", Payload: json.RawMessage(`{"id":"project_visible","workspaceId":"` + workspaceID + `","name":"可见项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:00:00Z","updatedAt":"2026-07-01T08:00:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_hidden", UpdatedAt: "2026-07-01T08:01:00Z", Payload: json.RawMessage(`{"id":"project_hidden","workspaceId":"` + workspaceID + `","name":"不可见项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:01:00Z","updatedAt":"2026-07-01T08:01:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_visible", UpdatedAt: "2026-07-01T08:02:00Z", Payload: json.RawMessage(`{"id":"task_visible","workspaceId":"` + workspaceID + `","projectId":"project_visible","project":"可见项目","title":"可见任务","status":"pool","createdAt":"2026-07-01T08:02:00Z","updatedAt":"2026-07-01T08:02:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_hidden", UpdatedAt: "2026-07-01T08:03:00Z", Payload: json.RawMessage(`{"id":"task_hidden","workspaceId":"` + workspaceID + `","projectId":"project_hidden","project":"不可见项目","title":"不可见任务","status":"pool","createdAt":"2026-07-01T08:03:00Z","updatedAt":"2026-07-01T08:03:00Z"}`)},
		{WorkspaceID: workspaceID, AccountID: "account_teammate", Entity: "daily_plan", ID: "plan_account_teammate_" + workspaceID + "_2026-07-04", UpdatedAt: "2026-07-04T08:00:00Z", Payload: json.RawMessage(`{"id":"plan_account_teammate_` + workspaceID + `_2026-07-04","workspaceId":"` + workspaceID + `","ownerAccountId":"account_teammate","date":"2026-07-04","capacityPomodoros":3,"committedTaskIds":["task_visible"],"completedPomodoros":0,"suggestedTaskIds":[],"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-07-04T08:00:00Z","updatedAt":"2026-07-04T08:00:00Z"}`)},
	})

	memberRecorder := httptest.NewRecorder()
	memberBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_visible","name":"项目成员","email":"project-only@example.com","password":"demo","roles":["executor"],"status":"active"}`))
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", memberBody), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create project-only member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}
	var sharedMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, workspaceID, member.Account.ID).Scan(&sharedMembershipCount); err != nil {
		t.Fatal(err)
	}
	if sharedMembershipCount != 0 {
		t.Fatalf("project-only member should not have workspace membership, got %d", sharedMembershipCount)
	}

	projectOnlyLoginRecorder := httptest.NewRecorder()
	api.handleLogin(projectOnlyLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"demo","device_id":"device_member"}`))))
	if projectOnlyLoginRecorder.Code != http.StatusOK {
		t.Fatalf("project-only login status = %d, body = %s", projectOnlyLoginRecorder.Code, projectOnlyLoginRecorder.Body.String())
	}
	var projectOnlyLogin loginResponse
	if err := json.Unmarshal(projectOnlyLoginRecorder.Body.Bytes(), &projectOnlyLogin); err != nil {
		t.Fatal(err)
	}
	projectOnlyAuth := authContext{AccountID: projectOnlyLogin.Account.ID, WorkspaceID: projectOnlyLogin.Workspace.ID}
	stateRecorder := httptest.NewRecorder()
	api.handleTeamDataLoad(stateRecorder, httptest.NewRequest(http.MethodGet, "/team/data", nil), projectOnlyAuth)
	if stateRecorder.Code != http.StatusOK {
		t.Fatalf("team state all status = %d, body = %s", stateRecorder.Code, stateRecorder.Body.String())
	}
	var stateResponse teamDataResponse
	if err := json.Unmarshal(stateRecorder.Body.Bytes(), &stateResponse); err != nil {
		t.Fatal(err)
	}
	visible := map[string]bool{}
	for _, row := range stateResponse.Rows {
		visible[row.Entity+"/"+row.ID] = true
	}
	if !visible["project/project_visible"] || !visible["task/task_visible"] {
		t.Fatalf("project-only state missing visible project rows: %#v", visible)
	}
	if !visible["daily_plan/plan_account_teammate_"+workspaceID+"_2026-07-04"] {
		t.Fatalf("project-only state missing teammate daily plan for visible project task: %#v", visible)
	}
	if visible["project/project_hidden"] || visible["task/task_hidden"] {
		t.Fatalf("project-only state leaked hidden project rows: %#v", visible)
	}
	dailyPlanRow := businessRow{
		WorkspaceID: workspaceID,
		AccountID:   projectOnlyAuth.AccountID,
		Entity:      "daily_plan",
		ID:          "plan_" + projectOnlyAuth.AccountID + "_" + workspaceID + "_2026-07-04",
		UpdatedAt:   "2026-07-04T08:00:00Z",
		Payload:     json.RawMessage(`{"id":"plan_` + projectOnlyAuth.AccountID + `_` + workspaceID + `_2026-07-04","workspaceId":"` + workspaceID + `","ownerAccountId":"` + projectOnlyAuth.AccountID + `","date":"2026-07-04","capacityPomodoros":3,"committedTaskIds":["task_visible"],"completedPomodoros":0,"suggestedTaskIds":[],"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-07-04T08:00:00Z","updatedAt":"2026-07-04T08:00:00Z"}`),
	}
	saveRows(t, api, projectOnlyAuth, "device_member", append(stateResponse.Rows, dailyPlanRow))
	reloadedRows := loadRows(t, api, projectOnlyAuth, 0)
	reloaded := map[string]bool{}
	for _, row := range reloadedRows.Rows {
		reloaded[row.Entity+"/"+row.ID] = true
	}
	if !reloaded["daily_plan/"+dailyPlanRow.ID] {
		t.Fatalf("project-only state missing account daily plan: %#v", reloaded)
	}
	modifiedRows := append([]businessRow(nil), reloadedRows.Rows...)
	teammatePlanID := "plan_account_teammate_" + workspaceID + "_2026-07-04"
	for index := range modifiedRows {
		if modifiedRows[index].Entity != "daily_plan" || modifiedRows[index].ID != teammatePlanID {
			continue
		}
		modifiedRows[index].UpdatedAt = "2026-07-04T09:00:00Z"
		modifiedRows[index].Payload = bytes.Replace(
			modifiedRows[index].Payload,
			[]byte(`"reflection":""`),
			[]byte(`"reflection":"unauthorized change"`),
			1,
		)
	}
	modifiedBody, err := json.Marshal(teamDataSaveRequest{Rows: modifiedRows})
	if err != nil {
		t.Fatal(err)
	}
	modifiedRecorder := httptest.NewRecorder()
	api.handleTeamDataSave(modifiedRecorder, httptest.NewRequest(http.MethodPut, "/team/data", bytes.NewReader(modifiedBody)), projectOnlyAuth)
	if modifiedRecorder.Code != http.StatusForbidden {
		t.Fatalf("modify teammate daily plan status = %d, body = %s", modifiedRecorder.Code, modifiedRecorder.Body.String())
	}
	hiddenPlanRow := dailyPlanRow
	hiddenPlanRow.ID = "plan_" + projectOnlyAuth.AccountID + "_" + workspaceID + "_2026-07-05"
	hiddenPlanRow.UpdatedAt = "2026-07-05T08:00:00Z"
	hiddenPlanRow.Payload = json.RawMessage(`{"id":"` + hiddenPlanRow.ID + `","workspaceId":"` + workspaceID + `","ownerAccountId":"` + projectOnlyAuth.AccountID + `","date":"2026-07-05","capacityPomodoros":3,"committedTaskIds":["task_hidden"],"completedPomodoros":0,"suggestedTaskIds":[],"reflection":"","review":{"mood":"normal","wins":"","blockers":"","interruptionPattern":"","tomorrowFocus":""},"createdAt":"2026-07-05T08:00:00Z","updatedAt":"2026-07-05T08:00:00Z"}`)
	hiddenBody, err := json.Marshal(teamDataSaveRequest{Rows: append(stateResponse.Rows, hiddenPlanRow)})
	if err != nil {
		t.Fatal(err)
	}
	hiddenRecorder := httptest.NewRecorder()
	api.handleTeamDataSave(hiddenRecorder, httptest.NewRequest(http.MethodPut, "/team/data", bytes.NewReader(hiddenBody)), projectOnlyAuth)
	if hiddenRecorder.Code != http.StatusForbidden {
		t.Fatalf("hidden daily plan task status = %d, body = %s", hiddenRecorder.Code, hiddenRecorder.Body.String())
	}

	disableRecorder := httptest.NewRecorder()
	disableBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","status":"disabled","roles":["executor"]}`))
	api.handleMemberByID(disableRecorder, httptest.NewRequest(http.MethodPatch, "/members/"+member.Member.ID, disableBody), sharedAuth)
	if disableRecorder.Code != http.StatusOK {
		t.Fatalf("disable project member status = %d, body = %s", disableRecorder.Code, disableRecorder.Body.String())
	}

	rejoinRecorder := httptest.NewRecorder()
	rejoinBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_visible","name":"项目成员","email":"project-only@example.com","password":"should-not-change","roles":["executor"],"status":"active"}`))
	api.handleMembers(rejoinRecorder, httptest.NewRequest(http.MethodPost, "/members", rejoinBody), sharedAuth)
	if rejoinRecorder.Code != http.StatusOK {
		t.Fatalf("rejoin project member status = %d, body = %s", rejoinRecorder.Code, rejoinRecorder.Body.String())
	}

	oldPasswordRecorder := httptest.NewRecorder()
	api.handleLogin(oldPasswordRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"demo","device_id":"device_member_old_password"}`))))
	if oldPasswordRecorder.Code != http.StatusOK {
		t.Fatalf("project-only old password login status = %d, body = %s", oldPasswordRecorder.Code, oldPasswordRecorder.Body.String())
	}
	changedPasswordRecorder := httptest.NewRecorder()
	api.handleLogin(changedPasswordRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-only@example.com","password":"should-not-change","device_id":"device_member_changed_password"}`))))
	if changedPasswordRecorder.Code == http.StatusOK {
		t.Fatalf("project-level rejoin should not change existing account password")
	}
}
