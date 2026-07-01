package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"time"

	"github.com/go-sql-driver/mysql"
)

func emptyStore() store {
	return store{
		Version:      2,
		NextRevision: 1,
		Workspaces:   map[string]workspaceData{},
		Accounts:     map[string]accountRecord{},
		Users:        map[string]userData{},
	}
}

func openMySQLStore(dsn string) (*sql.DB, store, error) {
	db, err := openMySQLDB(dsn)
	if err != nil {
		return nil, store{}, err
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := ensureMySQLSchema(ctx, db); err != nil {
		_ = db.Close()
		return nil, store{}, err
	}
	if err := ensureDefaultAdminAccount(ctx, db); err != nil {
		_ = db.Close()
		return nil, store{}, err
	}
	return db, emptyStore(), nil
}

func openMySQLDB(dsn string) (*sql.DB, error) {
	if dsn == "" {
		return nil, errors.New("mysql_dsn is required")
	}
	if err := ensureMySQLDatabase(dsn); err != nil {
		return nil, err
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, err
	}
	return db, nil
}

func ensureMySQLDatabase(dsn string) error {
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}
	if cfg.DBName == "" {
		return errors.New("mysql_dsn must include a database name")
	}
	dbName := cfg.DBName
	cfg.DBName = ""
	serverDB, err := sql.Open("mysql", cfg.FormatDSN())
	if err != nil {
		return err
	}
	defer serverDB.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := serverDB.PingContext(ctx); err != nil {
		return err
	}
	_, err = serverDB.ExecContext(ctx, fmt.Sprintf("CREATE DATABASE IF NOT EXISTS `%s` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci", escapeMySQLIdentifier(dbName)))
	return err
}

func ensureMySQLSchema(ctx context.Context, db *sql.DB) error {
	return applyMySQLMigrations(ctx, db)
}

func ensureMySQLColumn(ctx context.Context, db *sql.DB, tableName string, columnName string, alterStatement string) error {
	var count int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		tableName,
		columnName,
	).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := db.ExecContext(ctx, alterStatement)
	return err
}

func ensureMySQLIndex(ctx context.Context, db *sql.DB, tableName string, indexName string, alterStatement string) error {
	var count int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?`,
		tableName,
		indexName,
	).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}
	_, err := db.ExecContext(ctx, alterStatement)
	return err
}

func migrateMySQLWorkspaces(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`UPDATE workspaces SET type = 'shared' WHERE type IS NULL OR type = ''`,
		`UPDATE workspaces w
		 SET owner_account_id = (
		  SELECT a.id FROM accounts a WHERE a.workspace_id = w.id ORDER BY a.created_at ASC LIMIT 1
		 )
		 WHERE (w.owner_account_id IS NULL OR w.owner_account_id = '') AND w.type = 'shared'`,
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		 SELECT CONCAT('membership_', a.workspace_id, '_', a.id),
		  a.workspace_id,
		  a.id,
		  CASE WHEN w.owner_account_id = a.id THEN 'owner' ELSE 'member' END,
		  CASE WHEN a.disabled_at IS NULL OR a.disabled_at = '' THEN 'active' ELSE 'disabled' END,
		  a.created_at,
		  a.updated_at
		 FROM accounts a
		 JOIN workspaces w ON w.id = a.workspace_id
		 ON DUPLICATE KEY UPDATE
		  role = IF(workspace_memberships.role = '', VALUES(role), workspace_memberships.role),
		  status = VALUES(status),
		  updated_at = VALUES(updated_at)`,
		`INSERT INTO workspaces (id, name, type, owner_account_id, created_at, updated_at)
		 SELECT CONCAT('workspace_private_', a.id),
		  CONCAT(a.name, '的私人工作区'),
		  'private',
		  a.id,
		  a.created_at,
		  a.updated_at
		 FROM accounts a
		 ON DUPLICATE KEY UPDATE
		  type = 'private',
		  owner_account_id = VALUES(owner_account_id),
		  updated_at = VALUES(updated_at)`,
		`INSERT INTO workspace_memberships (id, workspace_id, account_id, role, status, created_at, updated_at)
		 SELECT CONCAT('membership_workspace_private_', a.id, '_', a.id),
		  CONCAT('workspace_private_', a.id),
		  a.id,
		  'owner',
		  CASE WHEN a.disabled_at IS NULL OR a.disabled_at = '' THEN 'active' ELSE 'disabled' END,
		  a.created_at,
		  a.updated_at
		 FROM accounts a
		 ON DUPLICATE KEY UPDATE
		  role = 'owner',
		  status = VALUES(status),
		  updated_at = VALUES(updated_at)`,
	}
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

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

	rowRows, err := db.QueryContext(ctx, `SELECT workspace_id, entity, entity_id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload FROM sync_rows`)
	if err != nil {
		return s, err
	}
	defer rowRows.Close()
	for rowRows.Next() {
		var row syncRow
		var userID sql.NullString
		var accountID sql.NullString
		var deletedAt sql.NullString
		if err := rowRows.Scan(&row.WorkspaceID, &row.Entity, &row.ID, &userID, &accountID, &row.DeviceID, &row.UpdatedAt, &deletedAt, &row.Version, &row.Revision, &row.Payload); err != nil {
			return s, err
		}
		if userID.Valid {
			row.UserID = userID.String
		}
		if accountID.Valid {
			row.AccountID = accountID.String
		}
		if deletedAt.Valid {
			row.DeletedAt = deletedAt.String
		}
		workspace := s.Workspaces[row.WorkspaceID]
		if workspace.ID == "" {
			workspace.ID = row.WorkspaceID
			workspace.Name = "默认团队"
			workspace.Type = "shared"
			workspace.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			workspace.UpdatedAt = workspace.CreatedAt
		}
		if workspace.Type == "" {
			workspace.Type = "shared"
		}
		if workspace.Rows == nil {
			workspace.Rows = map[string]syncRow{}
		}
		workspace.Rows[key(row.Entity, row.ID)] = row
		s.Workspaces[row.WorkspaceID] = workspace
	}
	if err := rowRows.Err(); err != nil {
		return s, err
	}
	return s, nil
}

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
	for _, statement := range []string{`DELETE FROM sync_rows`, `DELETE FROM workspace_memberships`, `DELETE FROM accounts`, `DELETE FROM workspaces`} {
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
			workspaceID := fallback(row.WorkspaceID, workspace.ID)
			payload := row.Payload
			if len(payload) == 0 {
				payload = []byte(`{}`)
			}
			if _, err := tx.ExecContext(
				ctx,
				`INSERT INTO sync_rows (workspace_id, entity, entity_id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				workspaceID,
				row.Entity,
				row.ID,
				nullString(row.UserID),
				nullString(row.AccountID),
				row.DeviceID,
				row.UpdatedAt,
				nullString(row.DeletedAt),
				row.Version,
				row.Revision,
				payload,
			); err != nil {
				return fmt.Errorf("insert sync row %s/%s: %w", row.Entity, row.ID, err)
			}
		}
	}

	return tx.Commit()
}

func nullString(value string) sql.NullString {
	if value == "" {
		return sql.NullString{}
	}
	return sql.NullString{String: value, Valid: true}
}

func escapeMySQLIdentifier(value string) string {
	escaped := ""
	for _, char := range value {
		if char == '`' {
			escaped += "``"
		} else {
			escaped += string(char)
		}
	}
	return escaped
}
