package main

import (
	"context"
	"database/sql"
)

func loadStoreFromMySQL(ctx context.Context, db *sql.DB) (store, error) {
	s := emptyStore()
	if err := db.QueryRowContext(ctx, `SELECT value_bigint FROM sync_meta WHERE key_name = 'next_revision'`).Scan(&s.NextRevision); err != nil {
		return s, err
	}
	if s.NextRevision < 1 {
		s.NextRevision = 1
	}

	workspaceRows, err := db.QueryContext(ctx, `SELECT id, name, type, owner_account_id, created_at, updated_at FROM workspaces`)
	if err != nil {
		return s, err
	}
	defer workspaceRows.Close()
	for workspaceRows.Next() {
		var workspace workspaceData
		var ownerAccountID sql.NullString
		if err := workspaceRows.Scan(&workspace.ID, &workspace.Name, &workspace.Type, &ownerAccountID, &workspace.CreatedAt, &workspace.UpdatedAt); err != nil {
			return s, err
		}
		if ownerAccountID.Valid {
			workspace.OwnerAccountID = ownerAccountID.String
		}
		workspace.Rows = map[string]syncRow{}
		s.Workspaces[workspace.ID] = workspace
	}
	if err := workspaceRows.Err(); err != nil {
		return s, err
	}

	accountRows, err := db.QueryContext(ctx, `SELECT id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at FROM accounts`)
	if err != nil {
		return s, err
	}
	defer accountRows.Close()
	for accountRows.Next() {
		var account accountRecord
		var disabledAt sql.NullString
		if err := accountRows.Scan(&account.ID, &account.WorkspaceID, &account.Name, &account.Email, &account.PasswordHash, &disabledAt, &account.CreatedAt, &account.UpdatedAt); err != nil {
			return s, err
		}
		if disabledAt.Valid {
			account.DisabledAt = disabledAt.String
		}
		s.Accounts[account.ID] = account
	}
	if err := accountRows.Err(); err != nil {
		return s, err
	}

	for workspaceID, workspace := range s.Workspaces {
		rows, err := teamLoadRowsWithOptions(ctx, db, workspaceID, true)
		if err != nil {
			return s, err
		}
		if workspace.Rows == nil {
			workspace.Rows = map[string]syncRow{}
		}
		for _, row := range rows {
			workspace.Rows[key(row.Entity, row.ID)] = row
		}
		s.Workspaces[workspaceID] = workspace
	}
	return s, nil
}
