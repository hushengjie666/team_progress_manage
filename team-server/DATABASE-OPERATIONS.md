# TimeManage Database Operations

TimeManage `v0.2.3` manages its MySQL schema with embedded, ordered SQL migrations. The permanent baseline is `v0.1.2`; rollback below that release is not supported.

Before an upgrade, run the read-only integrity audit and review every non-zero result:

```bat
timemanage-team.exe db audit --config backend.json
```

## Requirements

- MySQL 5.7 or newer.
- `mysqldump` and `mysql` clients installed on the backend host and available on `PATH`, or configured with `mysqldump_path` and `mysql_path` in `backend.json`.
- A TCP `mysql_dsn`. Backup and restore intentionally reject socket DSNs.
- The configured MySQL account must have permission to drop and recreate the configured database when using restore.

## Commands

Run commands from the `server` directory:

```text
timemanage-team.exe db status --config backend.json
timemanage-team.exe db up --config backend.json
timemanage-team.exe db backup --config backend.json
timemanage-team.exe db backup --config backend.json --output backups\before-upgrade.sql.gz
timemanage-team.exe db rollback --config backend.json --to v0.1.2 --confirm
timemanage-team.exe db restore --config backend.json --file backups\before-upgrade.sql.gz --confirm
```

The matching `.json` file beside every `.sql.gz` backup contains its release, schema version, size, SHA-256, and creation time. Restore refuses a backup when this manifest is missing or does not match.

## Upgrade

The server takes a MySQL advisory lock and applies safe pending migrations during startup. A database newer than the server is rejected. If a pending migration is marked as requiring backup, startup stops until `db backup` has produced a verified backup within `migration_backup_max_age_hours`.

For a controlled deployment:

1. Stop the backend service.
2. Run `backup-database.bat`.
3. Run `migrate-database.bat` and then `database-status.bat`.
4. Start the backend service and verify `/health`.

## Rollback And Restore

Use `rollback-database.bat <release>` only for migrations that provide a safe SQL down path. Stop the backend before rollback and deploy the matching application binary immediately afterward.

Migrations that can discard or reinterpret data are restore-only. For those releases, stop the backend and use `restore-database.bat <backup.sql.gz>`, then deploy the application version matching the restored database. Restore verifies the backup, drops and recreates only the database named in `mysql_dsn`, and imports the SQL into that database. Keep both the compressed SQL file and its manifest together.
