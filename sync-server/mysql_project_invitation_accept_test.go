package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLProjectInvitationAcceptAddsProjectMembershipOnly(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("admin login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var adminLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &adminLogin); err != nil {
		t.Fatal(err)
	}
	adminAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: adminLogin.Workspace.ID}

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"项目受邀人","email":"project-invitee@example.com","password":"secret","status":"active"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"项目邀请协作区","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	workspaceID := sharedLogin.Workspace.ID
	pushRows(t, api, sharedAuth, "device_seed", []syncRow{
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_invited", UpdatedAt: "2026-07-01T08:00:00Z", Payload: json.RawMessage(`{"id":"project_invited","workspaceId":"` + workspaceID + `","name":"受邀项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:00:00Z","updatedAt":"2026-07-01T08:00:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "project", ID: "project_other", UpdatedAt: "2026-07-01T08:01:00Z", Payload: json.RawMessage(`{"id":"project_other","workspaceId":"` + workspaceID + `","name":"其他项目","defaultExpectedStartHours":24,"createdAt":"2026-07-01T08:01:00Z","updatedAt":"2026-07-01T08:01:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_invited", UpdatedAt: "2026-07-01T08:02:00Z", Payload: json.RawMessage(`{"id":"task_invited","workspaceId":"` + workspaceID + `","projectId":"project_invited","project":"受邀项目","title":"受邀任务","status":"pool","createdAt":"2026-07-01T08:02:00Z","updatedAt":"2026-07-01T08:02:00Z"}`)},
		{WorkspaceID: workspaceID, Entity: "task", ID: "task_other", UpdatedAt: "2026-07-01T08:03:00Z", Payload: json.RawMessage(`{"id":"task_other","workspaceId":"` + workspaceID + `","projectId":"project_other","project":"其他项目","title":"其他任务","status":"pool","createdAt":"2026-07-01T08:03:00Z","updatedAt":"2026-07-01T08:03:00Z"}`)},
	})

	inviteRecorder := httptest.NewRecorder()
	inviteBody := bytes.NewReader([]byte(`{"workspace_id":"` + workspaceID + `","project_id":"project_invited","email":"project-invitee@example.com","roles":["executor"]}`))
	api.handleProjectInvitations(inviteRecorder, httptest.NewRequest(http.MethodPost, "/project-invitations", inviteBody), sharedAuth)
	if inviteRecorder.Code != http.StatusOK {
		t.Fatalf("project invite status = %d, body = %s", inviteRecorder.Code, inviteRecorder.Body.String())
	}
	var invitePayload struct {
		Invitation projectInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteRecorder.Body.Bytes(), &invitePayload); err != nil {
		t.Fatal(err)
	}
	if invitePayload.Invitation.ProjectName != "受邀项目" || invitePayload.Invitation.InviteeAccountID != accountPayload.Account.ID {
		t.Fatalf("project invitation = %#v", invitePayload.Invitation)
	}

	inviteeLoginRecorder := httptest.NewRecorder()
	api.handleLogin(inviteeLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"project-invitee@example.com","password":"secret","device_id":"device_project_invitee"}`))))
	if inviteeLoginRecorder.Code != http.StatusOK {
		t.Fatalf("invitee login status = %d, body = %s", inviteeLoginRecorder.Code, inviteeLoginRecorder.Body.String())
	}
	var inviteeLogin loginResponse
	if err := json.Unmarshal(inviteeLoginRecorder.Body.Bytes(), &inviteeLogin); err != nil {
		t.Fatal(err)
	}
	inviteeAuth := authContext{AccountID: inviteeLogin.Account.ID, WorkspaceID: inviteeLogin.Workspace.ID}

	listRecorder := httptest.NewRecorder()
	api.handleProjectInvitations(listRecorder, httptest.NewRequest(http.MethodGet, "/project-invitations", nil), inviteeAuth)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list project invitations status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	var listPayload struct {
		Invitations []projectInvitationSummary `json:"invitations"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Invitations) != 1 || listPayload.Invitations[0].ID != invitePayload.Invitation.ID {
		t.Fatalf("project invitations = %#v", listPayload.Invitations)
	}

	acceptRecorder := httptest.NewRecorder()
	api.handleProjectInvitationByID(acceptRecorder, httptest.NewRequest(http.MethodPost, "/project-invitations/"+invitePayload.Invitation.ID+"/accept", nil), inviteeAuth)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept project invitation status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptedPayload struct {
		Invitation projectInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(acceptRecorder.Body.Bytes(), &acceptedPayload); err != nil {
		t.Fatal(err)
	}
	if acceptedPayload.Invitation.Status != "accepted" || acceptedPayload.Invitation.AcceptedAt == "" {
		t.Fatalf("accepted project invitation = %#v", acceptedPayload.Invitation)
	}

	var workspaceMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, workspaceID, inviteeLogin.Account.ID).Scan(&workspaceMembershipCount); err != nil {
		t.Fatal(err)
	}
	if workspaceMembershipCount != 0 {
		t.Fatalf("project invitation should not add workspace membership, got %d", workspaceMembershipCount)
	}
	var projectMembershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM team_project_members WHERE workspace_id = ? AND project_id = ? AND account_ref = ? AND deleted_at IS NULL AND status = 'active'`, workspaceID, "project_invited", inviteeLogin.Account.ID).Scan(&projectMembershipCount); err != nil {
		t.Fatal(err)
	}
	if projectMembershipCount != 1 {
		t.Fatalf("project membership count = %d", projectMembershipCount)
	}

	workspacesRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspacesRecorder, httptest.NewRequest(http.MethodGet, "/workspaces", nil), inviteeAuth)
	if workspacesRecorder.Code != http.StatusOK {
		t.Fatalf("project invitee workspaces status = %d, body = %s", workspacesRecorder.Code, workspacesRecorder.Body.String())
	}
	var workspacesPayload struct {
		Workspaces  []workspaceSummary           `json:"workspaces"`
		Memberships []workspaceMembershipSummary `json:"memberships"`
	}
	if err := json.Unmarshal(workspacesRecorder.Body.Bytes(), &workspacesPayload); err != nil {
		t.Fatal(err)
	}
	hasProjectWorkspace := false
	for _, workspace := range workspacesPayload.Workspaces {
		if workspace.ID == workspaceID {
			hasProjectWorkspace = true
		}
	}
	if !hasProjectWorkspace {
		t.Fatalf("project invitee workspaces missing project workspace: %#v", workspacesPayload.Workspaces)
	}
	for _, membership := range workspacesPayload.Memberships {
		if membership.WorkspaceID == workspaceID {
			t.Fatalf("project invitee should not receive workspace membership: %#v", workspacesPayload.Memberships)
		}
	}

	stateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(stateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), inviteeAuth)
	if stateRecorder.Code != http.StatusOK {
		t.Fatalf("project invitee team state status = %d, body = %s", stateRecorder.Code, stateRecorder.Body.String())
	}
	var stateResponse pullResponse
	if err := json.Unmarshal(stateRecorder.Body.Bytes(), &stateResponse); err != nil {
		t.Fatal(err)
	}
	visible := map[string]bool{}
	for _, row := range stateResponse.Changes {
		visible[row.Entity+"/"+row.ID] = true
	}
	if !visible["project/project_invited"] || !visible["task/task_invited"] {
		t.Fatalf("project invitee state missing invited project rows: %#v", visible)
	}
	if visible["project/project_other"] || visible["task/task_other"] {
		t.Fatalf("project invitee state leaked other project rows: %#v", visible)
	}
}
