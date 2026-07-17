package main

import (
	"context"
	"database/sql"
)

func mysqlUpsertAccount(ctx context.Context, tx *sql.Tx, account accountRecord) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO accounts (id, workspace_id, name, email, password_hash, disabled_at, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), disabled_at = VALUES(disabled_at), updated_at = VALUES(updated_at)`,
		account.ID,
		account.WorkspaceID,
		account.Name,
		account.Email,
		account.PasswordHash,
		nullString(account.DisabledAt),
		account.CreatedAt,
		account.UpdatedAt,
	)
	return err
}

func mysqlUpdateAccount(ctx context.Context, tx *sql.Tx, account accountRecord) (bool, error) {
	result, err := tx.ExecContext(
		ctx,
		`UPDATE accounts SET workspace_id = ?, name = ?, email = ?, password_hash = ?, disabled_at = ?, updated_at = ?
		 WHERE id = ?`,
		account.WorkspaceID,
		account.Name,
		account.Email,
		account.PasswordHash,
		nullString(account.DisabledAt),
		account.UpdatedAt,
		account.ID,
	)
	if err != nil {
		return false, err
	}
	count, err := result.RowsAffected()
	if err != nil || count == 1 {
		return count == 1, err
	}
	_, found, lookupErr := mysqlAccountByID(ctx, tx, account.ID)
	return found, lookupErr
}
