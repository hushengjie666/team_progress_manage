package main

import (
	"context"
	"database/sql"
	"fmt"
	"time"
)

func saveStoreToMySQL(db *sql.DB, s store) error {
	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	tx, err := db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	if _, err := tx.ExecContext(
		ctx,
		`INSERT INTO sync_meta (key_name, value_bigint) VALUES ('next_revision', ?) ON DUPLICATE KEY UPDATE value_bigint = VALUES(value_bigint)`,
		s.NextRevision,
	); err != nil {
		return err
	}
	for _, spec := range teamEntityTables {
		if _, err := tx.ExecContext(ctx, fmt.Sprintf("DELETE FROM %s", spec.table)); err != nil {
			return err
		}
	}
	for _, statement := range []string{`DELETE FROM workspace_memberships`, `DELETE FROM accounts`, `DELETE FROM workspaces`} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	for _, workspace := range s.Workspaces {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
			workspace.ID,
			workspace.Name,
			fallback(workspace.Type, "shared"),
			nullString(workspace.OwnerAccountID),
			workspace.CreatedAt,
			workspace.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert workspace %s: %w", workspace.ID, err)
		}
	}

	for _, account := range s.Accounts {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO accounts (id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			account.ID,
			account.WorkspaceID,
			account.Name,
			account.Email,
			account.PasswordHash,
			nullString(account.DisabledAt),
			account.CreatedAt,
			account.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert account %s: %w", account.ID, err)
		}
		privateWorkspaceID := "workspace_private_" + account.ID
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at) VALUES (?, ?, 'private', ?, ?, ?)
				ON DUPLICATE KEY UPDATE type = 'private', owner_account_id = VALUES(owner_account_id), updated_at = VALUES(updated_at)`,
			privateWorkspaceID,
			fallback(account.Name, account.Email)+"的私人工作区",
			account.ID,
			account.CreatedAt,
			account.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert private workspace %s: %w", account.ID, err)
		}
		workspaceID := fallback(account.WorkspaceID, "workspace_private_"+account.ID)
		role := "member"
		if workspace := s.Workspaces[workspaceID]; workspace.OwnerAccountID == account.ID {
			role = "owner"
		}
		status := "active"
		if account.DisabledAt != "" {
			status = "disabled"
		}
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)
				ON DUPLICATE KEY UPDATE role = VALUES(role), status = VALUES(status), updated_at = VALUES(updated_at)`,
			"membership_"+workspaceID+"_"+account.ID,
			workspaceID,
			account.ID,
			role,
			status,
			account.CreatedAt,
			account.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert workspace membership %s: %w", account.ID, err)
		}
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at) VALUES (?, ?, ?, 'owner', ?, ?, ?)
				ON DUPLICATE KEY UPDATE role = 'owner', status = VALUES(status), updated_at = VALUES(updated_at)`,
			"membership_"+privateWorkspaceID+"_"+account.ID,
			privateWorkspaceID,
			account.ID,
			status,
			account.CreatedAt,
			account.UpdatedAt,
		); err != nil {
			return fmt.Errorf("insert private workspace membership %s: %w", account.ID, err)
		}
	}

	for _, workspace := range s.Workspaces {
		for _, row := range workspace.Rows {
			row.WorkspaceID = fallback(row.WorkspaceID, workspace.ID)
			if err := teamUpsertRow(ctx, tx, row); err != nil {
				return fmt.Errorf("insert team row %s/%s: %w", row.Entity, row.ID, err)
			}
		}
	}

	return tx.Commit()
}
