-- +goose Up
ALTER TABLE workspaces DROP COLUMN row_version;
ALTER TABLE accounts DROP COLUMN row_version;
ALTER TABLE workspace_memberships DROP COLUMN row_version;
ALTER TABLE workspace_invitations DROP COLUMN row_version;
ALTER TABLE project_invitations DROP COLUMN row_version;
ALTER TABLE business_projects DROP COLUMN row_version;
ALTER TABLE business_project_members DROP COLUMN row_version;
ALTER TABLE business_tasks DROP COLUMN row_version;
ALTER TABLE business_daily_plans DROP COLUMN row_version;
ALTER TABLE business_focus_sessions DROP COLUMN row_version;
ALTER TABLE business_work_sessions DROP COLUMN row_version;
ALTER TABLE business_execution_signals DROP COLUMN row_version;
ALTER TABLE business_interruptions DROP COLUMN row_version;
ALTER TABLE business_reward_state DROP COLUMN row_version;
ALTER TABLE business_task_templates DROP COLUMN row_version;
ALTER TABLE business_template_instances DROP COLUMN row_version;

CREATE TABLE IF NOT EXISTS idempotency_keys (
  account_id VARCHAR(191) NOT NULL,
  idempotency_key VARCHAR(191) NOT NULL,
  request_path VARCHAR(255) NOT NULL,
  response_status INT NOT NULL,
  response_body JSON NOT NULL,
  created_at VARCHAR(64) NOT NULL,
  PRIMARY KEY (account_id, idempotency_key),
  CONSTRAINT fk_idempotency_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS account_settings (
  account_id VARCHAR(191) NOT NULL,
  payload JSON NOT NULL,
  updated_at VARCHAR(64) NOT NULL,
  PRIMARY KEY (account_id),
  CONSTRAINT fk_account_settings_account FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE IF EXISTS account_settings;
DROP TABLE IF EXISTS idempotency_keys;
ALTER TABLE workspaces ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE accounts ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE workspace_memberships ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE workspace_invitations ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE project_invitations ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_projects ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_project_members ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_tasks ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_daily_plans ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_focus_sessions ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_work_sessions ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_execution_signals ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_interruptions ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_reward_state ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_task_templates ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
ALTER TABLE business_template_instances ADD COLUMN row_version BIGINT UNSIGNED NOT NULL DEFAULT 1;
