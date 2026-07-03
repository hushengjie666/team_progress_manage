package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

func mysqlUpsertProjectInvitation(ctx context.Context, tx *sql.Tx, invitation projectInvitationSummary) error {
	if !isInvitationStatus(invitation.Status) {
		return fmt.Errorf("project invitation status is required")
	}
	rolesRaw, err := json.Marshal(normalizeRoles(invitation.Roles))
	if err != nil {
		return err
	}
	_, err = tx.ExecContext(
		ctx,
		`INSERT INTO project_invitations (id, workspace_id, project_id, inviter_account_id, invitee_account_id, invitee_email, roles_json, status, created_at, updated_at, accepted_at)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON DUPLICATE KEY UPDATE
		  inviter_account_id = VALUES(inviter_account_id),
		  invitee_email = VALUES(invitee_email),
		  roles_json = VALUES(roles_json),
		  status = VALUES(status),
		  updated_at = VALUES(updated_at),
		  accepted_at = VALUES(accepted_at)`,
		invitation.ID,
		invitation.WorkspaceID,
		invitation.ProjectID,
		invitation.InviterAccountID,
		invitation.InviteeAccountID,
		invitation.InviteeEmail,
		rolesRaw,
		invitation.Status,
		invitation.CreatedAt,
		invitation.UpdatedAt,
		nullString(invitation.AcceptedAt),
	)
	return err
}
