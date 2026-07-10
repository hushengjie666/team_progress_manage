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
			ON DUPLICATE KEY UPDATE name = VALUES(name), email = VALUES(email), password_hash = VALUES(password_hash), disabled_at = VALUES(disabled_at), updated_at = VALUES(updated_at), row_version = row_version + 1`,
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

func mysqlUpdateAccountAtRevision(ctx context.Context, tx *sql.Tx, account accountRecord, expectedRevision int64) (bool, error) {
	result, err := tx.ExecContext(
		ctx,
		`UPDATE accounts SET workspace_id = ?, name = ?, email = ?, password_hash = ?, disabled_at = ?, updated_at = ?, row_version = row_version + 1
		 WHERE id = ? AND row_version = ?`,
		account.WorkspaceID,
		account.Name,
		account.Email,
		account.PasswordHash,
		nullString(account.DisabledAt),
		account.UpdatedAt,
		account.ID,
		expectedRevision,
	)
	if err != nil {
		return false, err
	}
	count, err := result.RowsAffected()
	return count == 1, err
}
