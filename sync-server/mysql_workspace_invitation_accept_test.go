package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLWorkspaceInvitationAcceptAddsMembership(t *testing.T) {
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
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"被邀请人","email":"invitee@example.com","password":"secret","status":"active"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"邀请协作区","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	ownerStateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(ownerStateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), sharedAuth)
	if ownerStateRecorder.Code != http.StatusOK {
		t.Fatalf("owner team state status = %d, body = %s", ownerStateRecorder.Code, ownerStateRecorder.Body.String())
	}
	var ownerState pullResponse
	if err := json.Unmarshal(ownerStateRecorder.Body.Bytes(), &ownerState); err != nil {
		t.Fatal(err)
	}
	if len(ownerState.Changes) != 0 {
		t.Fatalf("owner team state should not include workspace member sync rows: %#v", ownerState.Changes)
	}

	inviteBody := bytes.NewReader([]byte(`{"workspace_id":"` + sharedLogin.Workspace.ID + `","email":"invitee@example.com"}`))
	inviteRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(inviteRecorder, httptest.NewRequest(http.MethodPost, "/workspace-invitations", inviteBody), sharedAuth)
	if inviteRecorder.Code != http.StatusOK {
		t.Fatalf("invite status = %d, body = %s", inviteRecorder.Code, inviteRecorder.Body.String())
	}
	var invitePayload struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteRecorder.Body.Bytes(), &invitePayload); err != nil {
		t.Fatal(err)
	}
	if invitePayload.Invitation.Status != "pending" || invitePayload.Invitation.InviteeAccountID != accountPayload.Account.ID {
		t.Fatalf("invitation = %#v", invitePayload.Invitation)
	}

	inviteeLoginRecorder := httptest.NewRecorder()
	api.handleLogin(inviteeLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"invitee@example.com","password":"secret","device_id":"device_invitee"}`))))
	if inviteeLoginRecorder.Code != http.StatusOK {
		t.Fatalf("invitee login status = %d, body = %s", inviteeLoginRecorder.Code, inviteeLoginRecorder.Body.String())
	}
	var inviteeLogin loginResponse
	if err := json.Unmarshal(inviteeLoginRecorder.Body.Bytes(), &inviteeLogin); err != nil {
		t.Fatal(err)
	}
	inviteeAuth := authContext{AccountID: inviteeLogin.Account.ID, WorkspaceID: inviteeLogin.Workspace.ID}

	listRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(listRecorder, httptest.NewRequest(http.MethodGet, "/workspace-invitations", nil), inviteeAuth)
	if listRecorder.Code != http.StatusOK {
		t.Fatalf("list invitations status = %d, body = %s", listRecorder.Code, listRecorder.Body.String())
	}
	var listPayload struct {
		Invitations []workspaceInvitationSummary `json:"invitations"`
	}
	if err := json.Unmarshal(listRecorder.Body.Bytes(), &listPayload); err != nil {
		t.Fatal(err)
	}
	if len(listPayload.Invitations) != 1 || listPayload.Invitations[0].ID != invitePayload.Invitation.ID {
		t.Fatalf("invitations = %#v", listPayload.Invitations)
	}

	acceptRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitationByID(acceptRecorder, httptest.NewRequest(http.MethodPost, "/workspace-invitations/"+invitePayload.Invitation.ID+"/accept", nil), inviteeAuth)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept invitation status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}
	var acceptedPayload struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(acceptRecorder.Body.Bytes(), &acceptedPayload); err != nil {
		t.Fatal(err)
	}
	if acceptedPayload.Invitation.Status != "accepted" || acceptedPayload.Invitation.AcceptedAt == "" {
		t.Fatalf("accepted invitation = %#v", acceptedPayload.Invitation)
	}

	var membershipCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ? AND status = 'active'`, sharedLogin.Workspace.ID, inviteeLogin.Account.ID).Scan(&membershipCount); err != nil {
		t.Fatal(err)
	}
	if membershipCount != 1 {
		t.Fatalf("membership count = %d", membershipCount)
	}

	workspacesRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspacesRecorder, httptest.NewRequest(http.MethodGet, "/workspaces", nil), inviteeAuth)
	if workspacesRecorder.Code != http.StatusOK {
		t.Fatalf("invitee workspaces status = %d, body = %s", workspacesRecorder.Code, workspacesRecorder.Body.String())
	}
	var workspacesPayload struct {
		Workspaces  []workspaceSummary           `json:"workspaces"`
		Memberships []workspaceMembershipSummary `json:"memberships"`
	}
	if err := json.Unmarshal(workspacesRecorder.Body.Bytes(), &workspacesPayload); err != nil {
		t.Fatal(err)
	}
	hasSharedWorkspace := false
	sharedMemberships := []workspaceMembershipSummary{}
	for _, workspace := range workspacesPayload.Workspaces {
		if workspace.ID == sharedLogin.Workspace.ID {
			hasSharedWorkspace = true
		}
	}
	for _, membership := range workspacesPayload.Memberships {
		if membership.WorkspaceID == sharedLogin.Workspace.ID {
			sharedMemberships = append(sharedMemberships, membership)
		}
	}
	if !hasSharedWorkspace {
		t.Fatalf("invitee workspaces missing shared workspace: %#v", workspacesPayload.Workspaces)
	}
	if len(sharedMemberships) != 1 || sharedMemberships[0].AccountID != inviteeLogin.Account.ID {
		t.Fatalf("invitee shared memberships should only include self: %#v", sharedMemberships)
	}

	inviteeStateRecorder := httptest.NewRecorder()
	api.handleTeamStateAll(inviteeStateRecorder, httptest.NewRequest(http.MethodGet, "/team/state/all", nil), inviteeAuth)
	if inviteeStateRecorder.Code != http.StatusOK {
		t.Fatalf("invitee team state status = %d, body = %s", inviteeStateRecorder.Code, inviteeStateRecorder.Body.String())
	}
	var inviteeState pullResponse
	if err := json.Unmarshal(inviteeStateRecorder.Body.Bytes(), &inviteeState); err != nil {
		t.Fatal(err)
	}
	if len(inviteeState.Changes) != 0 {
		t.Fatalf("invitee team state should not include workspace member sync rows: %#v", inviteeState.Changes)
	}
}
