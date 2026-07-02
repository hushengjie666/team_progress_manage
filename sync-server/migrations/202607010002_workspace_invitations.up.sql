CREATE TABLE IF NOT EXISTS workspace_invitations (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
