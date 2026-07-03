package main

import (
	"context"
	"strings"
)

func teamProjectIDsForAccount(ctx context.Context, q sqlRunner, workspaceID string, accountID string) ([]string, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT DISTINCT project_id
		 FROM business_project_members
		 WHERE workspace_id = ? AND account_ref = ? AND project_id IS NOT NULL AND project_id <> ''
			   AND status = 'active'`,
		workspaceID,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	projectIDs := []string{}
	for rows.Next() {
		var projectID string
		if err := rows.Scan(&projectID); err != nil {
			return nil, err
		}
		projectIDs = append(projectIDs, projectID)
	}
	return teamUniqueStrings(projectIDs), rows.Err()
}

func teamAccountCanAccessProject(ctx context.Context, q sqlRunner, workspaceID string, accountID string, projectID string) (bool, error) {
	if strings.TrimSpace(projectID) == "" {
		return false, nil
	}
	var count int
	err := q.QueryRowContext(
		ctx,
		`SELECT COUNT(*)
		 FROM business_project_members
		 WHERE workspace_id = ? AND project_id = ? AND account_ref = ?
			   AND status = 'active'`,
		workspaceID,
		projectID,
		accountID,
	).Scan(&count)
	return count > 0, err
}

func teamAccountCanManageWorkspace(ctx context.Context, q sqlRunner, auth authContext, workspaceID string) (bool, error) {
	if isDefaultAdminAuth(auth) {
		if _, found, err := mysqlWorkspaceByID(ctx, q, workspaceID); err != nil || !found {
			return false, err
		}
		return true, nil
	}
	membership, found, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, q, auth.AccountID, workspaceID)
	if err != nil || !found {
		return false, err
	}
	return membership.Role == "owner" || membership.Role == "admin", nil
}

func teamAccountCanManageProjectMembers(ctx context.Context, q sqlRunner, workspaceID string, accountID string, projectID string) (bool, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project_member' AS entity, id, account_id, updated_at, payload
		 FROM business_project_members
		 WHERE workspace_id = ? AND project_id = ? AND account_ref = ?
			   AND status = 'active'`,
		workspaceID,
		projectID,
		accountID,
	)
	if err != nil {
		return false, err
	}
	defer rows.Close()
	items, err := scanBusinessRows(rows)
	if err != nil {
		return false, err
	}
	for _, row := range items {
		if hasRole(row.Payload, "project_owner") {
			return true, nil
		}
	}
	return false, nil
}
