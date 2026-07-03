package main

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"
)

func TestMySQLWorkspaceSwitchingIsolationAndSharedMemberships(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	api := newApp(defaultConfig(), db)

	loginBody := bytes.NewReader([]byte(`{"email":"admin","password":"hu626699","device_id":"device_mysql"}`))
	loginRecorder := httptest.NewRecorder()
	api.handleLogin(loginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", loginBody))
	if loginRecorder.Code != http.StatusOK {
		t.Fatalf("login status = %d, body = %s", loginRecorder.Code, loginRecorder.Body.String())
	}
	var privateLogin loginResponse
	if err := json.Unmarshal(loginRecorder.Body.Bytes(), &privateLogin); err != nil {
		t.Fatal(err)
	}
	if privateLogin.Workspace.Type != "private" || privateLogin.Membership.Role != "owner" {
		t.Fatalf("private workspace/membership = %#v", privateLogin)
	}
	privateAuth := authContext{AccountID: privateLogin.Account.ID, WorkspaceID: privateLogin.Workspace.ID}

	pushRows(t, api, privateAuth, "device_private", []syncRow{{
		Entity:    "project",
		ID:        "project_private",
		UpdatedAt: "2026-07-01T08:00:00Z",
		Payload:   json.RawMessage(`{"id":"project_private","name":"私人项目","updatedAt":"2026-07-01T08:00:00Z"}`),
	}})

	createSharedBody := bytes.NewReader([]byte(`{"name":"协作一组","type":"shared","device_id":"device_private"}`))
	createSharedRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSharedRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", createSharedBody), privateAuth)
	if createSharedRecorder.Code != http.StatusOK {
		t.Fatalf("create shared status = %d, body = %s", createSharedRecorder.Code, createSharedRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(createSharedRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	if sharedLogin.Workspace.Type != "shared" || len(sharedLogin.Workspaces) < 2 {
		t.Fatalf("shared login response = %#v", sharedLogin)
	}
	sharedAuth := authContext{AccountID: sharedLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	pushRows(t, api, sharedAuth, "device_shared", []syncRow{{
		Entity:    "project",
		ID:        "project_shared",
		UpdatedAt: "2026-07-01T08:10:00Z",
		Payload:   json.RawMessage(`{"id":"project_shared","name":"协作项目","updatedAt":"2026-07-01T08:10:00Z"}`),
	}})

	privateRows := pullRows(t, api, privateAuth, 0)
	if len(privateRows.Changes) != 1 || privateRows.Changes[0].ID != "project_private" {
		t.Fatalf("private workspace rows leaked or missing: %#v", privateRows)
	}
	sharedRows := pullRows(t, api, sharedAuth, 0)
	if len(sharedRows.Changes) != 1 || sharedRows.Changes[0].ID != "project_shared" {
		t.Fatalf("shared workspace rows leaked or missing: %#v", sharedRows)
	}

	switchBody := bytes.NewReader([]byte(`{"workspace_id":"` + privateLogin.Workspace.ID + `","device_id":"device_shared"}`))
	switchRecorder := httptest.NewRecorder()
	api.handleSwitchWorkspace(switchRecorder, httptest.NewRequest(http.MethodPost, "/auth/switch-workspace", switchBody), sharedAuth)
	if switchRecorder.Code != http.StatusOK {
		t.Fatalf("switch status = %d, body = %s", switchRecorder.Code, switchRecorder.Body.String())
	}
	var switched loginResponse
	if err := json.Unmarshal(switchRecorder.Body.Bytes(), &switched); err != nil {
		t.Fatal(err)
	}
	if switched.Workspace.ID != privateLogin.Workspace.ID || switched.Workspace.Type != "private" {
		t.Fatalf("switch response = %#v", switched)
	}

	memberBody := bytes.NewReader([]byte(`{"name":"协作者","email":"member@example.com","password":"member-secret","status":"active"}`))
	memberRecorder := httptest.NewRecorder()
	api.handleMembers(memberRecorder, httptest.NewRequest(http.MethodPost, "/members", memberBody), sharedAuth)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("create member status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var member memberResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &member); err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := db.ExecContext(
		context.Background(),
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		 VALUES (?, ?, ?, 'member', 'active', ?, ?)
		 ON DUPLICATE KEY UPDATE status = 'active', updated_at = VALUES(updated_at)`,
		"membership_"+privateLogin.Workspace.ID+"_"+member.Account.ID,
		privateLogin.Workspace.ID,
		member.Account.ID,
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(context.Background(), `UPDATE accounts SET workspace_id = ? WHERE id = ?`, privateLogin.Workspace.ID, member.Account.ID); err != nil {
		t.Fatal(err)
	}

	memberLoginBody := bytes.NewReader([]byte(`{"email":"member@example.com","password":"member-secret","device_id":"device_member"}`))
	memberLoginRecorder := httptest.NewRecorder()
	api.handleLogin(memberLoginRecorder, httptest.NewRequest(http.MethodPost, "/auth/login", memberLoginBody))
	if memberLoginRecorder.Code != http.StatusOK {
		t.Fatalf("member login status = %d, body = %s", memberLoginRecorder.Code, memberLoginRecorder.Body.String())
	}
	var memberLogin loginResponse
	if err := json.Unmarshal(memberLoginRecorder.Body.Bytes(), &memberLogin); err != nil {
		t.Fatal(err)
	}
	if memberLogin.Workspace.ID == privateLogin.Workspace.ID {
		t.Fatalf("member defaulted into another account private workspace: %#v", memberLogin.Workspace)
	}
	memberPrivateID := privateWorkspaceID(member.Account.ID)
	hasMemberPrivate := false
	hasSharedWorkspace := false
	for _, workspace := range memberLogin.Workspaces {
		if workspace.ID == privateLogin.Workspace.ID {
			t.Fatalf("member workspaces leaked owner private workspace: %#v", memberLogin.Workspaces)
		}
		if workspace.ID == memberPrivateID {
			hasMemberPrivate = true
		}
		if workspace.ID == sharedLogin.Workspace.ID {
			hasSharedWorkspace = true
		}
	}
	if !hasMemberPrivate || !hasSharedWorkspace {
		t.Fatalf("member workspaces missing expected entries: %#v", memberLogin.Workspaces)
	}

	memberAuth := authContext{AccountID: memberLogin.Account.ID, WorkspaceID: memberLogin.Workspace.ID}
	deniedSwitchBody := bytes.NewReader([]byte(`{"workspace_id":"` + privateLogin.Workspace.ID + `","device_id":"device_member"}`))
	deniedSwitchRecorder := httptest.NewRecorder()
	api.handleSwitchWorkspace(deniedSwitchRecorder, httptest.NewRequest(http.MethodPost, "/auth/switch-workspace", deniedSwitchBody), memberAuth)
	if deniedSwitchRecorder.Code != http.StatusForbidden {
		t.Fatalf("switch into another private workspace status = %d, body = %s", deniedSwitchRecorder.Code, deniedSwitchRecorder.Body.String())
	}

	staleToken, err := api.signToken(tokenClaims{
		UserID:      memberLogin.Account.ID,
		AccountID:   memberLogin.Account.ID,
		WorkspaceID: privateLogin.Workspace.ID,
		Exp:         time.Now().UTC().Add(time.Hour).Unix(),
	})
	if err != nil {
		t.Fatal(err)
	}
	staleRequest := httptest.NewRequest(http.MethodGet, "/team/state", nil)
	staleRequest.Header.Set("Authorization", "Bearer "+staleToken)
	staleRecorder := httptest.NewRecorder()
	api.withAuth(api.handleTeamState)(staleRecorder, staleRequest)
	if staleRecorder.Code != http.StatusUnauthorized {
		t.Fatalf("stale private workspace token status = %d, body = %s", staleRecorder.Code, staleRecorder.Body.String())
	}

	createSecondBody := bytes.NewReader([]byte(`{"name":"协作二组","type":"shared"}`))
	createSecondRecorder := httptest.NewRecorder()
	api.handleWorkspaces(createSecondRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", createSecondBody), sharedAuth)
	if createSecondRecorder.Code != http.StatusOK {
		t.Fatalf("create second shared status = %d, body = %s", createSecondRecorder.Code, createSecondRecorder.Body.String())
	}
	var secondShared loginResponse
	if err := json.Unmarshal(createSecondRecorder.Body.Bytes(), &secondShared); err != nil {
		t.Fatal(err)
	}
	secondSharedAuth := authContext{AccountID: secondShared.Account.ID, WorkspaceID: secondShared.Workspace.ID}

	existingMemberBody := bytes.NewReader([]byte(`{"name":"协作者","email":"member@example.com","status":"active"}`))
	existingMemberRecorder := httptest.NewRecorder()
	api.handleMembers(existingMemberRecorder, httptest.NewRequest(http.MethodPost, "/members", existingMemberBody), secondSharedAuth)
	if existingMemberRecorder.Code != http.StatusOK {
		t.Fatalf("add existing account status = %d, body = %s", existingMemberRecorder.Code, existingMemberRecorder.Body.String())
	}

	var accountCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM accounts WHERE email = 'member@example.com'`).Scan(&accountCount); err != nil {
		t.Fatal(err)
	}
	if accountCount != 1 {
		t.Fatalf("member account count = %d", accountCount)
	}
	var membershipCount int
	if err := db.QueryRowContext(
		context.Background(),
		`SELECT COUNT(*) FROM workspace_memberships WHERE account_id = ? AND workspace_id IN (?, ?) AND status = 'active'`,
		member.Account.ID,
		sharedLogin.Workspace.ID,
		secondShared.Workspace.ID,
	).Scan(&membershipCount); err != nil {
		t.Fatal(err)
	}
	if membershipCount != 2 {
		t.Fatalf("member active shared memberships = %d", membershipCount)
	}
}
