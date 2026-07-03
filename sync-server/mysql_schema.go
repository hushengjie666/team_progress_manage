package main

import (
	"context"
	"database/sql"
	"fmt"
)

func ensureMySQLSchema(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS workspaces (
			id VARCHAR(128) NOT NULL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(24) NOT NULL,
			owner_account_id VARCHAR(128) NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			KEY idx_workspaces_owner (owner_account_id),
			KEY idx_workspaces_type (type)
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
		`CREATE TABLE IF NOT EXISTS workspace_memberships (
			id VARCHAR(128) NOT NULL PRIMARY KEY,
			workspace_id VARCHAR(128) NOT NULL,
			account_id VARCHAR(128) NOT NULL,
			role VARCHAR(32) NOT NULL,
			status VARCHAR(32) NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			UNIQUE KEY idx_workspace_membership_account (workspace_id, account_id),
			KEY idx_workspace_memberships_account (account_id, status),
			KEY idx_workspace_memberships_workspace (workspace_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS workspace_invitations (
			id VARCHAR(160) NOT NULL PRIMARY KEY,
			workspace_id VARCHAR(128) NOT NULL,
			inviter_account_id VARCHAR(128) NOT NULL,
			invitee_account_id VARCHAR(128) NOT NULL,
			invitee_email VARCHAR(255) NOT NULL,
			status VARCHAR(32) NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			accepted_at VARCHAR(40) NULL,
			KEY idx_workspace_invitations_invitee (invitee_account_id, status),
			KEY idx_workspace_invitations_workspace (workspace_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS project_invitations (
			id VARCHAR(160) NOT NULL PRIMARY KEY,
			workspace_id VARCHAR(128) NOT NULL,
			project_id VARCHAR(128) NOT NULL,
			inviter_account_id VARCHAR(128) NOT NULL,
			invitee_account_id VARCHAR(128) NOT NULL,
			invitee_email VARCHAR(255) NOT NULL,
			roles_json JSON NOT NULL,
			status VARCHAR(32) NOT NULL,
			created_at VARCHAR(40) NOT NULL,
			updated_at VARCHAR(40) NOT NULL,
			accepted_at VARCHAR(40) NULL,
			KEY idx_project_invitations_invitee (invitee_account_id, status),
			KEY idx_project_invitations_project (workspace_id, project_id, status),
			KEY idx_project_invitations_lookup (workspace_id, project_id, invitee_account_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS business_projects (
			workspace_id VARCHAR(128) NOT NULL,
			id VARCHAR(128) NOT NULL,
			account_id VARCHAR(128) NULL,
			project_id VARCHAR(128) NULL,
			task_id VARCHAR(128) NULL,
			account_ref VARCHAR(128) NULL,
			status VARCHAR(64) NULL,
			kind VARCHAR(64) NULL,
			row_date VARCHAR(32) NULL,
			updated_at VARCHAR(40) NOT NULL,
			payload JSON NOT NULL,
			PRIMARY KEY (workspace_id, id),
			KEY idx_business_projects_project (workspace_id, project_id),
			KEY idx_business_projects_task (workspace_id, task_id),
			KEY idx_business_projects_account (workspace_id, account_id),
			KEY idx_business_projects_status (workspace_id, status)
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS business_project_members LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_tasks LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_daily_plans LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_focus_sessions LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_work_sessions LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_execution_signals LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_interruptions LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_reward_state LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_task_templates LIKE business_projects`,
		`CREATE TABLE IF NOT EXISTS business_template_instances LIKE business_projects`,
	}
	for _, statement := range statements {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	if err := dropMySQLIndexIfExists(ctx, db, "workspace_invitations", "idx_workspace_invitations_unique_status"); err != nil {
		return err
	}
	return nil
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
