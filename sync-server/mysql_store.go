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
	if dsn == "" {
		return nil, store{}, errors.New("mysql_dsn is required")
	}
	if err := ensureMySQLDatabase(dsn); err != nil {
		return nil, store{}, err
	}
	db, err := sql.Open("mysql", dsn)
	if err != nil {
		return nil, store{}, err
	}
	db.SetMaxOpenConns(5)
	db.SetMaxIdleConns(2)
	db.SetConnMaxLifetime(30 * time.Minute)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := db.PingContext(ctx); err != nil {
		_ = db.Close()
		return nil, store{}, err
	}
	if err := ensureMySQLSchema(ctx, db); err != nil {
		_ = db.Close()
		return nil, store{}, err
	}
	return db, emptyStore(), nil
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
	statements := []string{
		`CREATE TABLE IF NOT EXISTS sync_meta (
			key_name VARCHAR(64) NOT NULL PRIMARY KEY,
			value_bigint BIGINT NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS workspaces (
			id VARCHAR(128) NOT NULL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS accounts (
			id VARCHAR(128) NOT NULL PRIMARY KEY,
			workspace_id VARCHAR(128) NOT NULL,
			name VARCHAR(255) NOT NULL,
			email VARCHAR(255) NOT NULL,
			password_hash VARCHAR(255) NOT NULL,
			disabled_at VARCHAR(40) NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			UNIQUE KEY idx_accounts_email (email),
			KEY idx_accounts_workspace (workspace_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS sync_rows (
			workspace_id VARCHAR(128) NOT NULL,
			entity VARCHAR(64) NOT NULL,
			entity_id VARCHAR(128) NOT NULL,
			user_id VARCHAR(128) NULL,
			account_id VARCHAR(128) NULL,
			device_id VARCHAR(128) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			deleted_at VARCHAR(40) NULL,
			version INT NOT NULL,
			revision BIGINT NOT NULL,
			payload JSON NOT NULL,
			PRIMARY KEY (workspace_id, entity, entity_id),
			KEY idx_sync_rows_workspace_revision (workspace_id, revision),
			KEY idx_sync_rows_entity_id (entity, entity_id)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS team_projects (
			workspace_id VARCHAR(128) NOT NULL,
			id VARCHAR(128) NOT NULL,
			user_id VARCHAR(128) NULL,
			account_id VARCHAR(128) NULL,
			device_id VARCHAR(128) NOT NULL,
			project_id VARCHAR(128) NULL,
			task_id VARCHAR(128) NULL,
			account_ref VARCHAR(128) NULL,
			status VARCHAR(64) NULL,
			kind VARCHAR(64) NULL,
			row_date VARCHAR(32) NULL,
			updated_at VARCHAR(40) NOT NULL,
			deleted_at VARCHAR(40) NULL,
			version INT NOT NULL,
			revision BIGINT NOT NULL,
			payload JSON NOT NULL,
			PRIMARY KEY (workspace_id, id),
			KEY idx_team_projects_revision (workspace_id, revision),
			KEY idx_team_projects_project (workspace_id, project_id),
			KEY idx_team_projects_task (workspace_id, task_id),
			KEY idx_team_projects_status (workspace_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS team_team_members LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_project_members LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_tasks LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_daily_plans LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_focus_sessions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_work_sessions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_execution_signals LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_interruptions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_strict_violations LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_block_profiles LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_settings LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_onboarding LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_reward_state LIKE team_projects`,
		`INSERT IGNORE INTO sync_meta (key_name, value_bigint) VALUES ('next_revision', 1)`,
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

	workspaceRows, err := db.QueryContext(ctx, `SELECT id, name, created_at, updated_at FROM workspaces`)
	if err != nil {
		return s, err
	}
	defer workspaceRows.Close()
	for workspaceRows.Next() {
		var workspace workspaceData
		if err := workspaceRows.Scan(&workspace.ID, &workspace.Name, &workspace.CreatedAt, &workspace.UpdatedAt); err != nil {
			return s, err
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
			workspace.CreatedAt = time.Now().UTC().Format(time.RFC3339)
			workspace.UpdatedAt = workspace.CreatedAt
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
	for _, statement := range []string{`DELETE FROM sync_rows`, `DELETE FROM accounts`, `DELETE FROM workspaces`} {
		if _, err := tx.ExecContext(ctx, statement); err != nil {
			return err
		}
	}

	for _, workspace := range s.Workspaces {
		if _, err := tx.ExecContext(
			ctx,
			`INSERT INTO workspaces (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)`,
			workspace.ID,
			workspace.Name,
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
