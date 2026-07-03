package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLWorkspaceMemberCreationDoesNotWriteTeamRows(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	loginBody := []byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`)
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", bytes.NewReader(loginBody)))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}

	workspaceBody := []byte(`{"name":"协作区","type":"shared"}`)
	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader(workspaceBody)), authContext{AccountID: login.Account.ID, WorkspaceID: login.Workspace.ID})
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: login.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	memberBody := []byte(`{"name":"成员","email":"member@example.com","password":"member-secret","status":"active"}`)
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", bytes.NewReader(memberBody)), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var response memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &response); err != nil {
		t.Fatal(err)
	}
	if response.Account.Email != "member@example.com" || response.Member.Entity != "" {
		t.Fatalf("workspace member response should only return account: %#v", response)
	}
	var membershipRows int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id = ? AND status = 'active'`, sharedLogin.Workspace.ID, response.Account.ID).Scan(&membershipRows); err != nil {
		t.Fatal(err)
	}
	if membershipRows != 1 {
		t.Fatalf("workspace membership rows = %d", membershipRows)
	}
}
func TestMySQLStoreSeedsDefaultAdminAccount(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	statusRecorder := httptest.NewRecorder()
	api.handleAuthStatus(statusRecorder, httptest.NewRequest(http.MethodGet, "/auth/status", nil))
	if statusRecorder.Code != http.StatusOK {
		t.Fatalf("status = %d, body = %s", statusRecorder.Code, statusRecorder.Body.String())
	}
	var status authStatusResponse
	if err := json.Unmarshal(statusRecorder.Body.Bytes(), &status); err != nil {
		t.Fatal(err)
	}
	if !status.Bootstrapped || status.WorkspaceID == "" {
		t.Fatalf("auth status = %#v", status)
	}

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_admin"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var login loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &login); err != nil {
		t.Fatal(err)
	}
	if login.Account.Email != "admin" || login.Account.Name != "超级管理员" || login.Workspace.Type != "private" {
		t.Fatalf("login = %#v", login)
	}
}
