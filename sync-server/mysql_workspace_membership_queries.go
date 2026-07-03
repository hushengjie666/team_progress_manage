package main

import (
	"context"
	"database/sql"
	"errors"
)

func mysqlMembershipByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipRecord, bool, error) {
	membership, err := scanWorkspaceMembership(q.QueryRowContext(
		ctx,
		`SELECT id, workspace_id, account_id, role, status, created_at, updated_at FROM workspace_memberships WHERE account_id = ? AND workspace_id = ?`,
		accountID,
		workspaceID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipRecord{}, false, nil
	}
	return membership, err == nil, err
}

func mysqlActiveMembershipByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipRecord, bool, error) {
	membership, ok, err := mysqlMembershipByAccountAndWorkspace(ctx, q, accountID, workspaceID)
	if err != nil || !ok || membership.Status != "active" {
		return workspaceMembershipRecord{}, false, err
	}
	return membership, true, nil
}

func mysqlMembershipSummaryByAccountAndWorkspace(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceMembershipSummary, bool, error) {
	var result workspaceMembershipSummary
	err := q.QueryRowContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.account_id = ? AND m.workspace_id = ? AND m.status = 'active'`,
		accountID,
		workspaceID,
	).Scan(&result.ID, &result.WorkspaceID, &result.AccountID, &result.Name, &result.Email, &result.Role, &result.Status, &result.CreatedAt, &result.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipSummary{}, false, nil
	}
	return result, err == nil, err
}
