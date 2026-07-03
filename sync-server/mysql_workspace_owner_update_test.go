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

func TestMySQLWorkspaceUpdateCanChangeSharedWorkspaceOwner(t *testing.T) {
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

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"新负责人","email":"new-owner@example.com","password":"secret","status":"active"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"待转负责人协作区","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, sharedLogin.Workspace.ID, accountPayload.Account.ID, "member", "active", now); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}

	updateRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		updateRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, bytes.NewReader([]byte(`{"name":"已转负责人协作区","type":"shared","owner_account_id":"`+accountPayload.Account.ID+`"}`))),
		sharedAuth,
	)
	if updateRecorder.Code != http.StatusOK {
		t.Fatalf("update workspace owner status = %d, body = %s", updateRecorder.Code, updateRecorder.Body.String())
	}
	var updatePayload struct {
		Workspace workspaceSummary `json:"workspace"`
	}
	if err := json.Unmarshal(updateRecorder.Body.Bytes(), &updatePayload); err != nil {
		t.Fatal(err)
	}
	if updatePayload.Workspace.OwnerAccountID != accountPayload.Account.ID {
		t.Fatalf("workspace owner = %q, want %q", updatePayload.Workspace.OwnerAccountID, accountPayload.Account.ID)
	}

	var oldOwnerRole string
	if err := db.QueryRowContext(context.Background(), `SELECT role FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, adminLogin.Account.ID).Scan(&oldOwnerRole); err != nil {
		t.Fatal(err)
	}
	if oldOwnerRole != "owner" {
		t.Fatalf("old owner role = %q", oldOwnerRole)
	}
	var newOwnerRole string
	if err := db.QueryRowContext(context.Background(), `SELECT role FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, sharedLogin.Workspace.ID, accountPayload.Account.ID).Scan(&newOwnerRole); err != nil {
		t.Fatal(err)
	}
	if newOwnerRole != "owner" {
		t.Fatalf("new owner role = %q", newOwnerRole)
	}
}

func TestMySQLWorkspaceMembershipRoleSupportsMultipleOwners(t *testing.T) {
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

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"共同负责人","email":"co-owner@example.com","password":"secret","status":"active"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"多负责人协作区","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}
	sharedAuth := authContext{AccountID: adminLogin.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}
	now := time.Now().UTC().Add(time.Second).Format(time.RFC3339)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, sharedLogin.Workspace.ID, accountPayload.Account.ID, "member", "active", now); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	membershipID := "membership_" + sharedLogin.Workspace.ID + "_" + accountPayload.Account.ID

	ownerRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		ownerRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID+"/members/"+membershipID, bytes.NewReader([]byte(`{"role":"owner"}`))),
		sharedAuth,
	)
	if ownerRecorder.Code != http.StatusOK {
		t.Fatalf("set member owner status = %d, body = %s", ownerRecorder.Code, ownerRecorder.Body.String())
	}
	var ownerPayload workspaceMembershipResponse
	if err := json.Unmarshal(ownerRecorder.Body.Bytes(), &ownerPayload); err != nil {
		t.Fatal(err)
	}
	if ownerPayload.Membership.Role != "owner" {
		t.Fatalf("updated membership role = %q", ownerPayload.Membership.Role)
	}

	workspacesRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspacesRecorder, httptest.NewRequest(http.MethodGet, "/workspaces", nil), sharedAuth)
	if workspacesRecorder.Code != http.StatusOK {
		t.Fatalf("list workspaces status = %d, body = %s", workspacesRecorder.Code, workspacesRecorder.Body.String())
	}
	var workspacesPayload struct {
		Memberships []workspaceMembershipSummary `json:"memberships"`
	}
	if err := json.Unmarshal(workspacesRecorder.Body.Bytes(), &workspacesPayload); err != nil {
		t.Fatal(err)
	}
	sharedMemberships := []workspaceMembershipSummary{}
	for _, membership := range workspacesPayload.Memberships {
		if membership.WorkspaceID == sharedLogin.Workspace.ID {
			sharedMemberships = append(sharedMemberships, membership)
		}
	}
	if len(sharedMemberships) != 2 {
		t.Fatalf("shared memberships = %#v", sharedMemberships)
	}
	if sharedMemberships[0].AccountID != adminLogin.Account.ID || sharedMemberships[1].AccountID != accountPayload.Account.ID {
		t.Fatalf("membership order changed after role update: %#v", sharedMemberships)
	}

	var ownerCount int
	if err := db.QueryRowContext(context.Background(), `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND role = 'owner' AND status = 'active'`, sharedLogin.Workspace.ID).Scan(&ownerCount); err != nil {
		t.Fatal(err)
	}
	if ownerCount != 2 {
		t.Fatalf("active owner count = %d", ownerCount)
	}

	memberRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		memberRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID+"/members/"+membershipID, bytes.NewReader([]byte(`{"role":"member"}`))),
		sharedAuth,
	)
	if memberRecorder.Code != http.StatusOK {
		t.Fatalf("unset member owner status = %d, body = %s", memberRecorder.Code, memberRecorder.Body.String())
	}
	var memberPayload workspaceMembershipResponse
	if err := json.Unmarshal(memberRecorder.Body.Bytes(), &memberPayload); err != nil {
		t.Fatal(err)
	}
	if memberPayload.Membership.Role != "member" {
		t.Fatalf("updated membership role after unset = %q", memberPayload.Membership.Role)
	}
}

func TestMySQLWorkspaceMemberCanRenameSharedWorkspaceOnly(t *testing.T) {
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

	accountRecorder := httptest.NewRecorder()
	api.handleAdminAccounts(accountRecorder, httptest.NewRequest(http.MethodPost, "/admin/accounts", bytes.NewReader([]byte(`{"name":"普通成员","email":"workspace-member@example.com","password":"secret","status":"active"}`))), adminAuth)
	if accountRecorder.Code != http.StatusOK {
		t.Fatalf("create platform account status = %d, body = %s", accountRecorder.Code, accountRecorder.Body.String())
	}
	var accountPayload platformAccountResponse
	if err := json.Unmarshal(accountRecorder.Body.Bytes(), &accountPayload); err != nil {
		t.Fatal(err)
	}

	workspaceRecorder := httptest.NewRecorder()
	api.handleWorkspaces(workspaceRecorder, httptest.NewRequest(http.MethodPost, "/workspaces", bytes.NewReader([]byte(`{"name":"成员可改名协作区","type":"shared"}`))), adminAuth)
	if workspaceRecorder.Code != http.StatusOK {
		t.Fatalf("create shared workspace status = %d, body = %s", workspaceRecorder.Code, workspaceRecorder.Body.String())
	}
	var sharedLogin loginResponse
	if err := json.Unmarshal(workspaceRecorder.Body.Bytes(), &sharedLogin); err != nil {
		t.Fatal(err)
	}

	now := time.Now().UTC().Format(time.RFC3339)
	tx, err := db.BeginTx(context.Background(), nil)
	if err != nil {
		t.Fatal(err)
	}
	if err := mysqlEnsureWorkspaceMembership(context.Background(), tx, sharedLogin.Workspace.ID, accountPayload.Account.ID, "member", "active", now); err != nil {
		_ = tx.Rollback()
		t.Fatal(err)
	}
	if err := tx.Commit(); err != nil {
		t.Fatal(err)
	}
	memberAuth := authContext{AccountID: accountPayload.Account.ID, WorkspaceID: sharedLogin.Workspace.ID}

	renameRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		renameRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, bytes.NewReader([]byte(`{"name":"成员已改名协作区","type":"shared"}`))),
		memberAuth,
	)
	if renameRecorder.Code != http.StatusOK {
		t.Fatalf("member rename workspace status = %d, body = %s", renameRecorder.Code, renameRecorder.Body.String())
	}
	var renamePayload struct {
		Workspace workspaceSummary `json:"workspace"`
	}
	if err := json.Unmarshal(renameRecorder.Body.Bytes(), &renamePayload); err != nil {
		t.Fatal(err)
	}
	if renamePayload.Workspace.Name != "成员已改名协作区" || renamePayload.Workspace.OwnerAccountID != adminLogin.Account.ID {
		t.Fatalf("renamed workspace = %#v", renamePayload.Workspace)
	}

	ownerRecorder := httptest.NewRecorder()
	api.handleWorkspaceByID(
		ownerRecorder,
		httptest.NewRequest(http.MethodPatch, "/workspaces/"+sharedLogin.Workspace.ID, bytes.NewReader([]byte(`{"name":"成员已改名协作区","type":"shared","owner_account_id":"`+accountPayload.Account.ID+`"}`))),
		memberAuth,
	)
	if ownerRecorder.Code != http.StatusForbidden {
		t.Fatalf("member owner update status = %d, body = %s", ownerRecorder.Code, ownerRecorder.Body.String())
	}
}
