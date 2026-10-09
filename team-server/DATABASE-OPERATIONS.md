# TimeManage Database Operations

TimeManage `v0.2.11` manages its MySQL schema with embedded, ordered SQL migrations. The permanent baseline is `v0.1.2`; rollback below that release is not supported. The `v0.2.11` release is schema 14: typed core columns and ordered relational details become authoritative, while JSON remains the API snapshot and extension store. Upgrade the server, Web frontend, and desktop client together.

Before an upgrade, run the read-only integrity audit and review every non-zero result:

```bat
timemanage-team.exe db audit --config backend.json
```

## Requirements

- MySQL 8.0 or newer. Schema 14 uses JSON_TABLE and does not support MySQL 5.7.
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
4. Start the backend service and verify `/health` returns `release_version: 0.2.11`, `api_protocol_version: 2`, `database_schema_version: 14`, and `minimum_client_release: 0.2.11`.

## Rollback And Restore

Use `rollback-database.bat <release>` only for migrations that provide a safe SQL down path. Stop the backend before rollback and deploy the matching application binary immediately afterward.

Migrations that can discard or reinterpret data are restore-only. For those releases, stop the backend and use `restore-database.bat <backup.sql.gz>`, then deploy the application version matching the restored database. Restore verifies the backup, drops and recreates only the database named in `mysql_dsn`, and imports the SQL into that database. Keep both the compressed SQL file and its manifest together.

## Schema 14 data protection

Backups use explicit INSERT columns and one row per INSERT. After export, the backend checks every table definition, column list and value count against the database. The recent-backup gate also requires the manifest database name to match the configured database. Keep the verified backup and manifest together, and test an actual restore into an isolated database before deployment.

For existing business data, schema 14 requires a recent verified backup; only an empty business schema may skip this migration's gate. The migration validates core field and collection types before schema changes. Unknown and historically missing fields are preserved without inventing values.

Up uses nontransactional MySQL DDL. If it fails after partial schema changes, restore the pre-upgrade backup before restarting the old server. A completed upgrade supports Down to v0.2.10: stop the service, back up its current data, run `db rollback --to v0.2.10 --confirm` with the 0.2.11 executable, then deploy the old executable. Down reconstructs the snapshot from the core columns and ordered detail rows before removing them. Switching binaries alone is not a database rollback.
