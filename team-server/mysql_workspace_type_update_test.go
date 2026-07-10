package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLWorkspaceUpdateCanMakeSharedWorkspacePrivate(t *testing.T) {
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

	for _, body := range []string{
		`{"name":"已加入成员","email":"joined@example.com","password":"secret","status":"active"}`,
		`{"name":"待邀请成员","email":"pending@example.com","password":"secret","status":"active"}`,
	} {
		recorder := httptest.NewRecorder()
		api.handleAdminAccounts(recorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(body))), adminAuth)
		if recorder.Code != http.StatusOK {
			t.Fatalf("create platform account status = %d, body = %s", recorder.Code, recorder.Body.String())
		}
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"协作待转私有","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	inviteJoinedRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(
		inviteJoinedRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations", bytes.NewReader([]byte(`{"workspace_id":"`+sharedLogin.Workspace.ID+`","email":"joined@example.com"}`))),
		sharedAuth,
	)
	if inviteJoinedRecorder.Code != http.StatusOK {
		t.Fatalf("invite joined status = %d, body = %s", inviteJoinedRecorder.Code, inviteJoinedRecorder.Body.String())
	}
	var joinedInvite struct {
		Invitation workspaceInvitationSummary `json:"invitation"`
	}
	if err := json.Unmarshal(inviteJoinedRecorder.Body.Bytes(), &joinedInvite); err != nil {
		t.Fatal(err)
	}

	joinedLoginRecorder := httptest.NewRecorder()
	api.handleLogin(joinedLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader([]byte(`{"email":"joined@example.com","password":"secret","device_id":"device_joined"}`))))
	if joinedLoginRecorder.Code != http.StatusOK {
		t.Fatalf("joined login status = %d, body = %s", joinedLoginRecorder.Code, joinedLoginRecorder.Body.String())
	}
	var joinedLogin loginResponse
	if err := json.Unmarshal(joinedLoginRecorder.Body.Bytes(), &joinedLogin); err != nil {
		t.Fatal(err)
	}
	acceptRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitationByID(
		acceptRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations/"+joinedInvite.Invitation.ID+"/accept", bytes.NewReader([]byte(`{"expected_revision":1}`))),
		authContext{AccountID: joinedLogin.Account.ID, WorkspaceID: joinedLogin.Workspace.ID},
	)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}

	pendingRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitations(
		pendingRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations", bytes.NewReader([]byte(`{"workspace_id":"`+sharedLogin.Workspace.ID+`","email":"pending@example.com"}`))),
		sharedAuth,
	)
	if pendingRecorder.Code != http.StatusOK {
		t.Fatalf("invite pending status = %d, body = %s", pendingRecorder.Code, pendingRecorder.Body.String())
	}
	impactRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		impactRecorder,
		httptest.NewRequest(http.MethodGet, "/workspaces/"+sharedLogin.Workspace.ID+"/restriction-impact", nil),
		sharedAuth,
	)
	if impactRecorder.Code != http.StatusOK {
		t.Fatalf("restriction impact status = %d, body = %s", impactRecorder.Code, impactRecorder.Body.String())
	}
	var impact map[string]int
	if err := json.Unmarshal(impactRecorder.Body.Bytes(), &impact); err != nil {
		t.Fatal(err)
	}
	if impact["active_members"] != 1 || impact["pending_invitations"] != 1 {
		t.Fatalf("restriction impact = %#v", impact)
	}
	currentRevision := mysqlRowRevision(t, db, "workspaces", sharedLogin.Workspace.ID)
	unconfirmedRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		unconfirmedRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, versionedJSONBody(t, `{"name":"转为私人","type":"private"}`, currentRevision)),
		sharedAuth,
	)
	if unconfirmedRecorder.Code != http.StatusPreconditionRequired {
		t.Fatalf("unconfirmed private conversion status = %d, body = %s", unconfirmedRecorder.Code, unconfirmedRecorder.Body.String())
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, versionedJSONBody(t, `{"name":"转为私人","type":"private","confirm_restrict_members":true}`, mysqlRowRevision(t, db, "workspaces", sharedLogin.Workspace.ID))),
		sharedAuth,
	)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("update workspace status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updatePayload struct {
		Workspace workspaceSummary `json:"workspace"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updatePayload); err != nil {
		t.Fatal(err)
	}
	if updatePayload.Workspace.Type != "private" || updatePayload.Workspace.Name != "转为私人" {
		t.Fatalf("updated workspace = %#v", updatePayload.Workspace)
	}

	var joinedStatus string
	if err := db.QueryRowContext(context.Background(), `SELECT status FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, joinedLogin.Account.ID).Scan(&joinedStatus); err != nil {
		t.Fatal(err)
	}
	if joinedStatus != "disabled" {
		t.Fatalf("joined membership status = %q", joinedStatus)
	}
	var pendingStatus string
	if err := db.QueryRowContext(context.Background(), `SELECT status FROM workspace_invitations WHERE workspace_id = ? AND invitee_email = ?`, sharedLogin.Workspace.ID, "pending@example.com").Scan(&pendingStatus); err != nil {
		t.Fatal(err)
	}
	if pendingStatus != "cancelled" {
		t.Fatalf("pending invitation status = %q", pendingStatus)
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(context.Background(), db, joinedLogin.Account.ID)
	if err != nil {
		t.Fatal(err)
	}
	for _, workspace := range workspaces {
		if workspace.ID == sharedLogin.Workspace.ID {
			t.Fatalf("private workspace leaked to former member: %#v", workspaces)
		}
	}
}

func TestMySQLWorkspaceUpdateRejectsPrivateWorkspaceTypeChange(t *testing.T) {
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
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}
	if login.Workspace.Type != "private" {
		t.Fatalf("login workspace = %#v", login.Workspace)
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+login.Workspace.ID, versionedJSONBody(t, `{"name":"仍是私人工作区","type":"shared"}`, mysqlRowRevision(t, db, "workspaces", login.Workspace.ID))),
		authContext{AccountID: login.Account.ID, WorkspaceID: login.Workspace.ID},
	)
	if updateRecorder.Code != http.StatusBadRequest {
		t.Fatalf("update private workspace status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}

	workspace, found, err := mysqlWorkspaceByID(context.Background(), db, login.Workspace.ID)
	if err != nil {
		t.Fatal(err)
	}
	if !found || workspace.Type != "private" {
		t.Fatalf("workspace after rejected update = %#v, found=%v", workspace, found)
	}
}
