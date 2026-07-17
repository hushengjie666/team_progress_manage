package main

import (
	"context"
	"database/sql"
	"fmt"
)

func mysqlUpsertWorkspace(ctx context.Context, tx *sql.Tx, workspace workspaceData) error {
	if !isWorkspaceType(workspace.Type) {
		return fmt.Errorf("workspace type is required")
	}
	_, err := tx.ExecContext(
		ctx,
		`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at)
			VALUES (?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE name = VALUES(name), type = VALUES(type), owner_account_id = VALUES(owner_account_id), updated_at = VALUES(updated_at)`,
		workspace.ID,
		workspace.Name,
		workspace.Type,
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

func mysqlUpdateWorkspace(ctx context.Context, tx *sql.Tx, workspace workspaceData) (bool, error) {
	result, err := tx.ExecContext(
		ctx,
		`UPDATE workspaces SET name = ?, type = ?, owner_account_id = ?, updated_at = ?
		 WHERE id = ?`,
		workspace.Name,
		workspace.Type,
		nullString(workspace.OwnerAccountID),
		workspace.UpdatedAt,
		workspace.ID,
	)
	if err != nil {
		return false, err
	}
	count, err := result.RowsAffected()
	return count == 1, err
}
