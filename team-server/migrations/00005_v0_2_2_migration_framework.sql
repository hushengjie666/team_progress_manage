-- +goose NO TRANSACTION
-- +goose Up
CREATE TABLE IF NOT EXISTS timemanage_migration_integrity (
  migration_version BIGINT NOT NULL PRIMARY KEY,
  release_version VARCHAR(32) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  recorded_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS timemanage_database_backups (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  schema_version BIGINT NOT NULL,
  release_version VARCHAR(32) NOT NULL,
  file_path VARCHAR(1024) NOT NULL,
  sha256 CHAR(64) NOT NULL,
  size_bytes BIGINT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TIMESTAMP NULL,
  KEY idx_timemanage_backups_version (schema_version, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- +goose Down
DROP TABLE IF EXISTS timemanage_database_backups;
DROP TABLE IF EXISTS timemanage_migration_integrity;
