package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strconv"
	"strings"
)

// Only an empty business schema can skip the new migration's backup gate.
func emptyRelationalMigration(ctx context.Context, db *sql.DB, pending []migrationDefinition) (bool, error) {
	for _, migration := range pending {
		if migration.RequiresBackup && migration.SchemaVersion != 14 {
			return false, nil
		}
	}
	for _, table := range businessEntityTables {
		exists, err := mysqlSchemaTableExists(ctx, db, table.table)
		if err != nil {
			return false, err
		}
		if !exists {
			continue
		}
		var populated bool
		if err := db.QueryRowContext(ctx, "SELECT EXISTS(SELECT 1 FROM "+table.table+" LIMIT 1)").Scan(&populated); err != nil {
			return false, err
		}
		if populated {
			return false, nil
		}
	}
	return true, nil
}

func moveBusinessCoreRow(ctx context.Context, tx *sql.Tx, row businessRow, targetWorkspace, now string) error {
	object, err := rowPayloadObject(row)
	if err != nil {
		return err
	}
	object["workspaceId"] = targetWorkspace
	raw, err := json.Marshal(object)
	if err != nil {
		return err
	}
	table, _ := businessTableForEntity(row.Entity)
	result, err := tx.ExecContext(ctx, "UPDATE "+table.table+" SET workspace_id = ?,payload = ?,updated_at = ? WHERE workspace_id = ? AND id = ?", targetWorkspace, raw, now, row.WorkspaceID, row.ID)
	if err != nil {
		return err
	}
	count, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if count != 1 {
		return fmt.Errorf("business row changed during project move")
	}
	row.WorkspaceID, row.UpdatedAt, row.Payload = targetWorkspace, now, raw
	return writeBusinessCore(ctx, tx, row)
}

func requireRelationalMySQL(ctx context.Context, db *sql.DB) error {
	var version string
	if err := db.QueryRowContext(ctx, "SELECT VERSION()").Scan(&version); err != nil {
		return err
	}
	major, err := strconv.Atoi(strings.SplitN(version, ".", 2)[0])
	if err != nil || major < 8 || strings.Contains(strings.ToLower(version), "mariadb") {
		return fmt.Errorf("schema 14 requires MySQL 8.0 or newer; database reports %s", version)
	}
	return nil
}
