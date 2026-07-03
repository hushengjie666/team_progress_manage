package main

import (
	"context"
	"database/sql"
)

func privateWorkspaceID(accountID string) string {
	return "workspace_private_" + accountID
}

func mysqlEnsurePrivateWorkspaceForAccount(ctx context.Context, tx *sql.Tx, account accountRecord, now string) (workspaceData, error) {
	workspace := workspaceData{
		ID:             privateWorkspaceID(account.ID),
		Name:           account.Name + "的私人工作区",
		Type:           "private",
		OwnerAccountID: account.ID,
		Rows:           map[string]syncRow{},
		CreatedAt:      account.CreatedAt,
		UpdatedAt:      now,
	}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		return workspaceData{}, err
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
		return workspaceData{}, err
	}
	return workspace, nil
}

func mysqlDefaultWorkspaceForAccount(ctx context.Context, q sqlRunner, account accountRecord) (workspaceData, bool, error) {
	if account.WorkspaceID != "" {
		if workspace, ok, err := mysqlWorkspaceVisibleToAccount(ctx, q, account.ID, account.WorkspaceID); err != nil {
			return workspaceData{}, false, err
		} else if ok {
			return workspace, true, nil
		}
	}
	privateID := privateWorkspaceID(account.ID)
	if workspace, ok, err := mysqlWorkspaceVisibleToAccount(ctx, q, account.ID, privateID); err != nil {
		return workspaceData{}, false, err
	} else if ok {
		return workspace, true, nil
	}
	rows, err := q.QueryContext(
		ctx,
		`SELECT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		 FROM workspace_memberships m
		 JOIN workspaces w ON w.id = m.workspace_id
		 WHERE m.account_id = ? AND m.status = 'active'
		   AND (w.type <> 'private' OR w.owner_account_id = ?)
		 ORDER BY w.created_at ASC LIMIT 1`,
		account.ID,
		account.ID,
	)
	if err != nil {
		return workspaceData{}, false, err
	}
	defer rows.Close()
	if rows.Next() {
		workspace, err := scanWorkspace(rows)
		return workspace, err == nil, err
	}
	if err := rows.Err(); err != nil {
		return workspaceData{}, false, err
	}
	return workspaceData{}, false, nil
}
