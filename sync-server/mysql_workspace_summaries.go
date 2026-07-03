package main

import (
	"context"
	"database/sql"
	"errors"
)

func mysqlWorkspaceSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]workspaceSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT id, name, type, owner_account_id, created_at, updated_at
		 FROM (
		   SELECT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		   FROM workspace_memberships m
		   JOIN workspaces w ON w.id = m.workspace_id
		   WHERE m.account_id = ? AND m.status = 'active'
			     AND (w.type <> 'private' OR w.owner_account_id = ?)
		   UNION
		   SELECT DISTINCT w.id, w.name, w.type, w.owner_account_id, w.created_at, w.updated_at
		   FROM team_project_members pm
		   JOIN workspaces w ON w.id = pm.workspace_id
			   WHERE pm.account_ref = ? AND pm.deleted_at IS NULL AND pm.status = 'active'
			     AND w.type <> 'private'
		 ) visible_workspaces
			 ORDER BY CASE WHEN type = 'private' THEN 0 ELSE 1 END, created_at ASC`,
		accountID,
		accountID,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceSummary{}
	for rows.Next() {
		workspace, err := scanWorkspace(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, publicWorkspace(workspace))
	}
	return result, rows.Err()
}

func mysqlWorkspaceMembershipSummaries(ctx context.Context, q sqlRunner, workspaceID string) ([]workspaceMembershipSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.workspace_id = ?
		 ORDER BY CASE m.role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END, a.name ASC`,
		workspaceID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceMembershipSummary{}
	for rows.Next() {
		var item workspaceMembershipSummary
		if err := rows.Scan(&item.ID, &item.WorkspaceID, &item.AccountID, &item.Name, &item.Email, &item.Role, &item.Status, &item.CreatedAt, &item.UpdatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}
	return result, rows.Err()
}

func mysqlWorkspaceMembershipSummaryByID(ctx context.Context, q sqlRunner, workspaceID string, membershipID string) (workspaceMembershipSummary, bool, error) {
	var item workspaceMembershipSummary
	err := q.QueryRowContext(
		ctx,
		`SELECT m.id, m.workspace_id, m.account_id, a.name, a.email, m.role, m.status, m.created_at, m.updated_at
		 FROM workspace_memberships m
		 JOIN accounts a ON a.id = m.account_id
		 WHERE m.workspace_id = ? AND m.id = ?`,
		workspaceID,
		membershipID,
	).Scan(&item.ID, &item.WorkspaceID, &item.AccountID, &item.Name, &item.Email, &item.Role, &item.Status, &item.CreatedAt, &item.UpdatedAt)
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceMembershipSummary{}, false, nil
	}
	return item, err == nil, err
}
