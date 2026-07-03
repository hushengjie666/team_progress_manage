package main

import (
	"context"
	"database/sql"
	"errors"
)

func mysqlFirstWorkspace(ctx context.Context, q sqlRunner) (workspaceData, bool, error) {
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, type, owner_account_id, created_at, updated_at FROM workspaces ORDER BY created_at ASC LIMIT 1`))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceData{}, false, nil
	}
	return workspace, err == nil, err
}

func mysqlWorkspaceByID(ctx context.Context, q sqlRunner, workspaceID string) (workspaceData, bool, error) {
	workspace, err := scanWorkspace(q.QueryRowContext(ctx, `SELECT id, name, type, owner_account_id, created_at, updated_at FROM workspaces WHERE id = ?`, workspaceID))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceData{}, false, nil
	}
	return workspace, err == nil, err
}

func mysqlWorkspaceVisibleToAccount(ctx context.Context, q sqlRunner, accountID string, workspaceID string) (workspaceData, bool, error) {
	workspace, found, err := mysqlWorkspaceByID(ctx, q, workspaceID)
	if err != nil || !found {
		return workspaceData{}, false, err
	}
	if fallback(workspace.Type, "shared") == "private" && workspace.OwnerAccountID != accountID {
		return workspaceData{}, false, nil
	}
	if _, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, q, accountID, workspaceID); err != nil || !found {
		return workspaceData{}, false, err
	}
	return workspace, true, nil
}
