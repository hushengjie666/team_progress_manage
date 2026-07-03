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
	if oldOwnerRole != "member" {
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
