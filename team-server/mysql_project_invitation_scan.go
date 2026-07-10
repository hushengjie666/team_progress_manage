package main

import (
	"database/sql"
	"encoding/json"
)

func scanProjectInvitationSummary(row interface{ Scan(...any) error }) (projectInvitationSummary, error) {
	var invitation projectInvitationSummary
	var rolesRaw []byte
	var acceptedAt sql.NullString
	var projectPayload string
	err := row.Scan(
		&invitation.ID,
		&invitation.WorkspaceID,
		&invitation.WorkspaceName,
		&invitation.ProjectID,
		&projectPayload,
		&invitation.InviterAccountID,
		&invitation.InviterName,
		&invitation.InviterEmail,
		&invitation.InviteeAccountID,
		&invitation.InviteeEmail,
		&rolesRaw,
		&invitation.Status,
		&invitation.CreatedAt,
		&invitation.UpdatedAt,
		&invitation.Revision,
		&acceptedAt,
	)
	if len(rolesRaw) > 0 {
		var roles []string
		if err := json.Unmarshal(rolesRaw, &roles); err == nil {
			invitation.Roles = normalizeRoles(roles)
		}
	}
	if len(invitation.Roles) == 0 {
		invitation.Roles = []string{"executor"}
	}
	if projectPayload != "" {
		invitation.ProjectName = stringField(json.RawMessage(projectPayload), "name")
	}
	if acceptedAt.Valid {
		invitation.AcceptedAt = acceptedAt.String
	}
	return invitation, err
}
