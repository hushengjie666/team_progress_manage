package main

import (
	"context"
	"database/sql"
)

func mysqlUpsertWorkspaceMembership(ctx context.Context, tx *sql.Tx, membership workspaceMembershipRecord) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE role = VALUES(role), status = VALUES(status), updated_at = VALUES(updated_at)`,
		membership.ID,
		membership.WorkspaceID,
		membership.AccountID,
		fallback(membership.Role, "member"),
		fallback(membership.Status, "active"),
		membership.CreatedAt,
		membership.UpdatedAt,
	)
	return err
}

func mysqlEnsureWorkspaceMembership(ctx context.Context, tx *sql.Tx, workspaceID string, accountID string, role string, status string, now string) error {
	return mysqlUpsertWorkspaceMembership(ctx, tx, workspaceMembershipRecord{
		ID:          "membership_" + workspaceID + "_" + accountID,
		WorkspaceID: workspaceID,
		AccountID:   accountID,
		Role:        fallback(role, "member"),
		Status:      fallback(status, "active"),
		CreatedAt:   now,
		UpdatedAt:   now,
	})
}

func mysqlRestrictWorkspaceToOwner(ctx context.Context, tx *sql.Tx, workspaceID string, ownerAccountID string, now string) error {
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships
		 SET status = 'disabled', updated_at = ?
		 WHERE workspace_id = ? AND account_id <> ? AND status <> 'disabled'`,
		now,
		workspaceID,
		ownerAccountID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_invitations
		 SET status = 'cancelled', updated_at = ?
		 WHERE workspace_id = ? AND status = 'pending'`,
		now,
		workspaceID,
	)
	return err
}

func mysqlSetWorkspaceOwner(ctx context.Context, tx *sql.Tx, workspaceID string, ownerAccountID string, now string) error {
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspaceID, ownerAccountID, "owner", "active", now); err != nil {
		return err
	}
	_, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships
		 SET role = 'member', updated_at = ?
		 WHERE workspace_id = ? AND account_id <> ? AND role = 'owner'`,
		now,
		workspaceID,
		ownerAccountID,
	)
	return err
}
