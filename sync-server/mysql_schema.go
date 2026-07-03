package main

import (
	"context"
	"database/sql"
)

func ensureMySQLSchema(ctx context.Context, db *sql.DB) error {
	statements := []string{
		`CREATE TABLE IF NOT EXISTS sync_meta (
			key_name VARCHAR(64) NOT NULL PRIMARY KEY,
			value_bigint BIGINT NOT NULL
		) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`,
		`CREATE TABLE IF NOT EXISTS workspaces (
			id VARCHAR(128) NOT NULL PRIMARY KEY,
			name VARCHAR(255) NOT NULL,
			type VARCHAR(24) NOT NULL DEFAULT 'shared',
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
			KEY idx_workspace_invitations_workspace (workspace_id, status),
			UNIQUE KEY idx_workspace_invitations_unique_status (workspace_id, invitee_account_id, status)
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
		`CREATE TABLE IF NOT EXISTS team_project_members LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_tasks LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_daily_plans LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_focus_sessions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_work_sessions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_execution_signals LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_interruptions LIKE team_projects`,
		`CREATE TABLE IF NOT EXISTS team_settings LIKE team_projects`,
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
