package main

import (
	"context"
	"fmt"
)

func runDatabaseCommand(ctx context.Context, invocation cliInvocation) error {
	if invocation.config.mysqlDSN == "" {
		return fmt.Errorf("mysql_dsn is required; set it in --config or TM_BACKEND_MYSQL_DSN")
	}
	switch invocation.command {
	case "db-restore":
		if !invocation.confirm {
			return fmt.Errorf("database restore requires --confirm")
		}
		if invocation.inputPath == "" {
			return fmt.Errorf("database restore requires --file <backup.sql.gz>")
		}
		manifest, err := restoreMySQLBackup(ctx, invocation.config, invocation.inputPath)
		if err != nil {
			return err
		}
		if err := verifyRestoredDatabase(ctx, invocation.config, manifest); err != nil {
			return fmt.Errorf("verify restored database: %w", err)
		}
		fmt.Printf("restored database backup %s (%s)\n", manifest.FilePath, manifest.ReleaseVersion)
		return nil
	}

	db, err := openMySQLDB(invocation.config.mysqlDSN)
	if err != nil {
		return err
	}
	defer db.Close()

	switch invocation.command {
	case "db-status":
		version, err := currentSchemaVersion(ctx, db)
		if err != nil {
			return err
		}
		fmt.Printf("database schema: %s\n", schemaVersionLabel(version))
		fmt.Printf("server schema:   %s (schema %d)\n", serverReleaseVersion, latestSchemaVersion)
		for _, migration := range migrationCatalog {
			state := "pending"
			if migration.SchemaVersion <= version {
				state = "applied"
			}
			fmt.Printf("%s  schema %d  %s\n", state, migration.SchemaVersion, migration.ReleaseVersion)
		}
		if version > latestSchemaVersion {
			return fmt.Errorf("database is newer than this server; use the matching server release")
		}
		return nil
	case "db-audit":
		issues, err := auditDatabaseIntegrity(ctx, db)
		if err != nil {
			return err
		}
		if issues > 0 {
			return fmt.Errorf("database integrity audit found %d issue(s)", issues)
		}
		return nil
	case "db-up":
		if err := migrateMySQLUp(ctx, db, invocation.config); err != nil {
			return err
		}
		if err := ensureDefaultAdminAccount(ctx, db); err != nil {
			return err
		}
		fmt.Printf("database schema is current at %s\n", serverReleaseVersion)
		return nil
	case "db-backup":
		manifest, err := createMySQLBackup(ctx, db, invocation.config, invocation.outputPath)
		if err != nil {
			return err
		}
		fmt.Printf("database backup: %s\nsha256: %s\n", manifest.FilePath, manifest.SHA256)
		return nil
	case "db-rollback":
		if !invocation.confirm {
			return fmt.Errorf("database rollback requires --confirm")
		}
		if invocation.target == "" {
			return fmt.Errorf("database rollback requires --to <release>, minimum v0.1.2")
		}
		target, err := migrationForRelease(invocation.target)
		if err != nil {
			return err
		}
		if err := migrateMySQLDown(ctx, db, target.SchemaVersion); err != nil {
			return err
		}
		fmt.Printf("database schema rolled back to %s\n", target.ReleaseVersion)
		return nil
	default:
		return fmt.Errorf("unsupported database command %q", invocation.command)
	}
}

func verifyRestoredDatabase(ctx context.Context, cfg config, manifest databaseBackupManifest) error {
	db, err := openMySQLDB(cfg.mysqlDSN)
	if err != nil {
		return err
	}
	defer db.Close()
	version, err := currentSchemaVersion(ctx, db)
	if err != nil {
		return err
	}
	baselineMatch := manifest.SchemaVersion == baselineSchemaVersion && version == 0
	if version != manifest.SchemaVersion && !baselineMatch {
		return fmt.Errorf("restored schema version %d does not match backup schema version %d", version, manifest.SchemaVersion)
	}
	if version >= latestSchemaVersion {
		return verifyMigrationIntegrity(ctx, db, version)
	}
	return nil
}

func schemaVersionLabel(version int64) string {
	if version == 0 {
		return "unversioned"
	}
	migration, err := migrationForSchemaVersion(version)
	if err != nil {
		return fmt.Sprintf("unknown (schema %d)", version)
	}
	return fmt.Sprintf("%s (schema %d)", migration.ReleaseVersion, version)
}
