package main

import (
	"context"
	"database/sql"
)

func mysqlUpsertWorkspace(ctx context.Context, tx *sql.Tx, workspace workspaceData) error {
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), owner_account_id = VALUES(owner_account_id), updated_at = VALUES(updated_at)`,
		workspace.ID,
		workspace.Name,
		fallback(workspace.Type, "shared"),
		nullString(workspace.OwnerAccountID),
		workspace.CreatedAt,
		workspace.UpdatedAt,
	)
	return err
}

func mysqlTouchWorkspace(ctx context.Context, tx *sql.Tx, workspaceID string, updatedAt string) error {
	_, err := tx.ExecContext(ctx, `UPDATE workspaces SET updated_at = ? WHERE id = ?`, updatedAt, workspaceID)
	return err
}
