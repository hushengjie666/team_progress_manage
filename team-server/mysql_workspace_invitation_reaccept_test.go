package main

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestMySQLWorkspaceInvitationAcceptReactivatesDisabledMembershipWithHistory(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLStore(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()

	ctx := context.Background()
	now := "2026-07-04T08:00:00Z"
	workspaceID := "workspace_reaccept"
	ownerID := "account_reaccept_owner"
	inviteeID := "account_reaccept_invitee"
	oldInvitationID := "workspace_invitation_reaccept_old"
	newInvitationID := "workspace_invitation_reaccept_new"

	if _, err := db.ExecContext(
		ctx,
		`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at) VALUES (?, ?, 'shared', ?, ?, ?)`,
		workspaceID,
		"重复邀请协作区",
		ownerID,
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(
		ctx,
		`INSERT INTO accounts (id, workspace_id, name, email, password_hash, created_at, updated_at) VALUES
		 (?, ?, '邀请人', 'reaccept-owner@example.com', 'hash', ?, ?),
		 (?, ?, '受邀人', 'reaccept-invitee@example.com', 'hash', ?, ?)`,
		ownerID,
		workspaceID,
		now,
		now,
		inviteeID,
		"workspace_invitee_home",
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(
		ctx,
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		 VALUES (?, ?, ?, 'member', 'disabled', ?, ?)`,
		"membership_"+workspaceID+"_"+inviteeID,
		workspaceID,
		inviteeID,
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(
		ctx,
		`INSERT INTO workspace_invitations (id, workspace_id, inviter_account_id, invitee_account_id, invitee_email, status, created_at, updated_at, accepted_at) VALUES
		 (?, ?, ?, ?, 'reaccept-invitee@example.com', 'accepted', ?, ?, ?),
		 (?, ?, ?, ?, 'reaccept-invitee@example.com', 'pending', ?, ?, NULL)`,
		oldInvitationID,
		workspaceID,
		ownerID,
		inviteeID,
		now,
		now,
		now,
		newInvitationID,
		workspaceID,
		ownerID,
		inviteeID,
		now,
		now,
	); err != nil {
		t.Fatal(err)
	}

	api := newApp(defaultConfig(), db)
	acceptRecorder := httptest.NewRecorder()
	api.handleWorkspaceInvitationByID(
		acceptRecorder,
		httptest.NewRequest(http.MethodPost, "/workspace-invitations/"+newInvitationID+"/accept", nil),
		authContext{AccountID: inviteeID, WorkspaceID: "workspace_invitee_home"},
	)
	if acceptRecorder.Code != http.StatusOK {
		t.Fatalf("accept invitation status = %d, body = %s", acceptRecorder.Code, acceptRecorder.Body.String())
	}

	var membershipStatus string
	if err := db.QueryRowContext(ctx, `SELECT status FROM workspace_memberships WHERE workspace_id = ? AND account_id = ?`, workspaceID, inviteeID).Scan(&membershipStatus); err != nil {
		t.Fatal(err)
	}
	if membershipStatus != "active" {
		t.Fatalf("membership status = %s", membershipStatus)
	}
	var acceptedCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_invitations WHERE workspace_id = ? AND invitee_account_id = ? AND status = 'accepted'`, workspaceID, inviteeID).Scan(&acceptedCount); err != nil {
		t.Fatal(err)
	}
	if acceptedCount != 2 {
		t.Fatalf("accepted invitation count = %d", acceptedCount)
	}
	var pendingCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_invitations WHERE workspace_id = ? AND invitee_account_id = ? AND status = 'pending'`, workspaceID, inviteeID).Scan(&pendingCount); err != nil {
		t.Fatal(err)
	}
	if pendingCount != 0 {
		t.Fatalf("pending invitation count = %d", pendingCount)
	}
}
