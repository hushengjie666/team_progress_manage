package main

import (
	"context"
	"database/sql"
	"fmt"
)

func ensureMySQLSchema(ctx context.Context, db *sql.DB) error {
	return migrateMySQLUp(ctx, db, defaultConfig())
}

func normalizeMySQLSchema(ctx context.Context, db *sql.DB) error {
	return dropMySQLIndexIfExists(ctx, db, "workspace_invitations", "idx_workspace_invitations_unique_status")
}

func mysqlIndexExists(ctx context.Context, q sqlRunner, tableName string, indexName string) (bool, error) {
	var count int
	if err := q.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
		tableName,
		indexName,
	).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func dropMySQLIndexIfExists(ctx context.Context, db *sql.DB, tableName string, indexName string) error {
	exists, err := mysqlIndexExists(ctx, db, tableName, indexName)
	if err != nil {
		return err
	}
	if !exists {
		return nil
	}
	_, err = db.ExecContext(
		ctx,
		fmt.Sprintf("ALTER TABLE `%s` DROP INDEX `%s`", escapeMySQLIdentifier(tableName), escapeMySQLIdentifier(indexName)),
	)
	return err
}
