-- +goose Up
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

-- +goose Down
ALTER TABLE business_template_instances DROP COLUMN row_version;
ALTER TABLE business_task_templates DROP COLUMN row_version;
ALTER TABLE business_reward_state DROP COLUMN row_version;
ALTER TABLE business_interruptions DROP COLUMN row_version;
ALTER TABLE business_execution_signals DROP COLUMN row_version;
ALTER TABLE business_work_sessions DROP COLUMN row_version;
ALTER TABLE business_focus_sessions DROP COLUMN row_version;
ALTER TABLE business_daily_plans DROP COLUMN row_version;
ALTER TABLE business_tasks DROP COLUMN row_version;
ALTER TABLE business_project_members DROP COLUMN row_version;
ALTER TABLE business_projects DROP COLUMN row_version;

ALTER TABLE project_invitations DROP COLUMN row_version;
ALTER TABLE workspace_invitations DROP COLUMN row_version;
ALTER TABLE workspace_memberships DROP COLUMN row_version;
ALTER TABLE accounts DROP COLUMN row_version;
ALTER TABLE workspaces DROP COLUMN row_version;
