package main

import "database/sql"

func scanAccount(row interface{ Scan(...any) error }) (accountRecord, error) {
	var account accountRecord
	var disabledAt sql.NullString
	err := row.Scan(&account.ID, &account.WorkspaceID, &account.Name, &account.Email, &account.PasswordHash, &disabledAt, &account.CreatedAt, &account.UpdatedAt)
	if disabledAt.Valid {
		account.DisabledAt = disabledAt.String
	}
	return account, err
}

func scanWorkspace(row interface{ Scan(...any) error }) (workspaceData, error) {
	var workspace workspaceData
	var ownerAccountID sql.NullString
	err := row.Scan(&workspace.ID, &workspace.Name, &workspace.Type, &ownerAccountID, &workspace.CreatedAt, &workspace.UpdatedAt)
	if workspace.Type == "" {
		workspace.Type = "shared"
	}
	if ownerAccountID.Valid {
		workspace.OwnerAccountID = ownerAccountID.String
	}
	return workspace, err
}

func scanWorkspaceMembership(row interface{ Scan(...any) error }) (workspaceMembershipRecord, error) {
	var membership workspaceMembershipRecord
	err := row.Scan(&membership.ID, &membership.WorkspaceID, &membership.AccountID, &membership.Role, &membership.Status, &membership.CreatedAt, &membership.UpdatedAt)
	return membership, err
}
