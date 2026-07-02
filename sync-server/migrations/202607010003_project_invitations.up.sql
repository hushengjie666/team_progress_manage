CREATE TABLE IF NOT EXISTS project_invitations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
