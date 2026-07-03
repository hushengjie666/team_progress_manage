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
