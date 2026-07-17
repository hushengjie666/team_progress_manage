package main

import (
	"context"
	"database/sql"
	"errors"
)

func mysqlProjectInvitationSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]projectInvitationSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN business_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id
		 WHERE i.invitee_account_id = ? AND i.status = 'pending'
		 ORDER BY i.created_at ASC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []projectInvitationSummary{}
	for rows.Next() {
		invitation, err := scanProjectInvitationSummary(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, invitation)
	}
	return result, rows.Err()
}

func mysqlProjectInvitationSummaryByID(ctx context.Context, q sqlRunner, invitationID string) (projectInvitationSummary, bool, error) {
	invitation, err := scanProjectInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN business_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id
		 WHERE i.id = ?`,
		invitationID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return projectInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlPendingProjectInvitation(ctx context.Context, q sqlRunner, workspaceID string, projectID string, inviteeAccountID string) (projectInvitationSummary, bool, error) {
	invitation, err := scanProjectInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, i.project_id, COALESCE(CAST(p.payload AS CHAR), ''),
		        i.inviter_account_id, inviter.name, inviter.email, i.invitee_account_id, i.invitee_email,
		        i.roles_json, i.status, i.created_at, i.updated_at, i.accepted_at
		 FROM project_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 LEFT JOIN business_projects p ON p.workspace_id = i.workspace_id AND p.id = i.project_id
		 WHERE i.workspace_id = ? AND i.project_id = ? AND i.invitee_account_id = ? AND i.status = 'pending'`,
		workspaceID,
		projectID,
		inviteeAccountID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return projectInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}
