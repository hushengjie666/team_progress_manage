package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

func scanWorkspaceInvitationSummary(row interface{ Scan(...any) error }) (workspaceInvitationSummary, error) {
	var invitation workspaceInvitationSummary
	var acceptedAt sql.NullString
	err := row.Scan(
		&invitation.ID,
		&invitation.WorkspaceID,
		&invitation.WorkspaceName,
		&invitation.WorkspaceType,
		&invitation.InviterAccountID,
		&invitation.InviterName,
		&invitation.InviterEmail,
		&invitation.InviteeAccountID,
		&invitation.InviteeEmail,
		&invitation.Status,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
		&invitation.Revision,
		&acceptedAt,
	)
	if acceptedAt.Valid {
		invitation.AcceptedAt = acceptedAt.String
	}
	return invitation, err
}

func mysqlWorkspaceInvitationSummariesForAccount(ctx context.Context, q sqlRunner, accountID string) ([]workspaceInvitationSummary, error) {
	rows, err := q.QueryContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.row_version, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.invitee_account_id = ? AND i.status = 'pending'
		 ORDER BY i.created_at ASC`,
		accountID,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	result := []workspaceInvitationSummary{}
	for rows.Next() {
		invitation, err := scanWorkspaceInvitationSummary(rows)
		if err != nil {
			return nil, err
		}
		result = append(result, invitation)
	}
	return result, rows.Err()
}

func mysqlWorkspaceInvitationSummaryByID(ctx context.Context, q sqlRunner, invitationID string) (workspaceInvitationSummary, bool, error) {
	invitation, err := scanWorkspaceInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.row_version, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.id = ?`,
		invitationID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlPendingWorkspaceInvitation(ctx context.Context, q sqlRunner, workspaceID string, inviteeAccountID string) (workspaceInvitationSummary, bool, error) {
	invitation, err := scanWorkspaceInvitationSummary(q.QueryRowContext(
		ctx,
		`SELECT i.id, i.workspace_id, w.name, w.type, i.inviter_account_id, inviter.name, inviter.email,
		        i.invitee_account_id, i.invitee_email, i.status, i.created_at, i.updated_at, i.row_version, i.accepted_at
		 FROM workspace_invitations i
		 JOIN workspaces w ON w.id = i.workspace_id
		 JOIN accounts inviter ON inviter.id = i.inviter_account_id
		 WHERE i.workspace_id = ? AND i.invitee_account_id = ? AND i.status = 'pending'`,
		workspaceID,
		inviteeAccountID,
	))
	if errors.Is(err, sql.ErrNoRows) {
		return workspaceInvitationSummary{}, false, nil
	}
	return invitation, err == nil, err
}

func mysqlUpsertWorkspaceInvitation(ctx context.Context, tx *sql.Tx, invitation workspaceInvitationSummary) error {
	if !isInvitationStatus(invitation.Status) {
		return fmt.Errorf("workspace invitation status is required")
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspace_invitations (id, workspace_id, inviter_account_id, invitee_account_id, invitee_email, status, created_at, updated_at, accepted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		  inviter_account_id = VALUES(inviter_account_id),
		  invitee_email = VALUES(invitee_email),
		  status = VALUES(status),
		  updated_at = VALUES(updated_at),
		  row_version = row_version + 1,
		  accepted_at = VALUES(accepted_at)`,
		invitation.ID,
		invitation.WorkspaceID,
		invitation.InviterAccountID,
		invitation.InviteeAccountID,
		invitation.InviteeEmail,
		invitation.Status,
		invitation.CreatedAt,
		invitation.UpdatedAt,
		nullString(invitation.AcceptedAt),
	)
	return err
}
