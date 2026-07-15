package main

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestMigrationCatalogIsContiguousAndChecksummed(t *testing.T) {
	if len(migrationCatalog) != int(latestSchemaVersion) {
		t.Fatalf("catalog length = %d, latest = %d", len(migrationCatalog), latestSchemaVersion)
	}
	for index, migration := range migrationCatalog {
		expectedVersion := int64(index + 1)
		if migration.SchemaVersion != expectedVersion {
			t.Fatalf("migration %d has schema version %d", index, migration.SchemaVersion)
		}
		if _, err := migrationChecksum(migration); err != nil {
			t.Fatalf("checksum migration %d: %v", migration.SchemaVersion, err)
		}
	}
	if migrationCatalog[len(migrationCatalog)-1].ReleaseVersion != serverReleaseVersion {
		t.Fatalf("latest migration is not aligned with %s", serverReleaseVersion)
	}
}

func TestMigrationReleaseLookupAndRiskRules(t *testing.T) {
	migration, err := migrationForRelease("0.1.2")
	if err != nil || migration.SchemaVersion != baselineSchemaVersion {
		t.Fatalf("baseline lookup = %#v, %v", migration, err)
	}
	if _, err := migrationForRelease("v0.1.1"); err == nil {
		t.Fatal("release below baseline should be rejected")
	}
	risky := migrationCatalog[3]
	risky.RequiresBackup = true
	risky.RestoreOnly = true
	original := migrationCatalog[3]
	migrationCatalog[3] = risky
	defer func() { migrationCatalog[3] = original }()
	if !pendingMigrationNeedsBackup(3, 5) {
		t.Fatal("backup gate did not detect a risky migration")
	}
	if !rollbackRequiresRestore(5, 3) {
		t.Fatal("rollback gate did not detect a restore-only migration")
	}
}

func TestMigrationsBetween(t *testing.T) {
	pending := migrationsBetween(3, 5)
	if len(pending) != 2 {
		t.Fatalf("pending migration count = %d, want 2", len(pending))
	}
	if pending[0].SchemaVersion != 4 || pending[1].SchemaVersion != 5 {
		t.Fatalf("pending migrations = %#v", pending)
	}
	if current := migrationsBetween(latestSchemaVersion, latestSchemaVersion); len(current) != 0 {
		t.Fatalf("current schema has pending migrations: %#v", current)
	}
}

func TestMySQLMigrationLifecycle(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	if _, err := db.ExecContext(ctx, `CREATE TABLE workspaces (
		id VARCHAR(128) NOT NULL PRIMARY KEY, name VARCHAR(255) NOT NULL, type VARCHAR(24) NOT NULL,
		owner_account_id VARCHAR(128) NULL, created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL,
		KEY idx_workspaces_owner (owner_account_id), KEY idx_workspaces_type (type)
	) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO workspaces VALUES ('preserved', 'Preserved', 'private', NULL, 'now', 'now')`); err != nil {
		t.Fatal(err)
	}
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err != nil {
		t.Fatal(err)
	}
	assertSchemaVersion(t, ctx, db, latestSchemaVersion)
	assertWorkspacePreserved(t, ctx, db)

	for target := latestSchemaVersion - 1; target >= baselineSchemaVersion; target-- {
		if err := migrateMySQLDown(ctx, db, target); err != nil {
			t.Fatalf("rollback to schema %d: %v", target, err)
		}
		assertSchemaVersion(t, ctx, db, target)
		assertWorkspacePreserved(t, ctx, db)
	}
	if err := migrateMySQLDown(ctx, db, 0); err == nil {
		t.Fatal("rollback below baseline should fail")
	}
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err != nil {
		t.Fatal(err)
	}
	assertSchemaVersion(t, ctx, db, latestSchemaVersion)
	var integrityCount int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM timemanage_migration_integrity`).Scan(&integrityCount); err != nil {
		t.Fatal(err)
	}
	if integrityCount != len(migrationCatalog) {
		t.Fatalf("integrity rows = %d", integrityCount)
	}
}

func TestMySQLMigrationRejectsAheadAndChangedSQL(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err != nil {
		t.Fatal(err)
	}
	if _, err := db.ExecContext(ctx, `UPDATE timemanage_migration_integrity SET sha256 = REPEAT('0', 64) WHERE migration_version = 1`); err != nil {
		t.Fatal(err)
	}
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err == nil || !strings.Contains(err.Error(), "checksum mismatch") {
		t.Fatalf("changed migration SQL was not rejected: %v", err)
	}
	if _, err := db.ExecContext(ctx, `INSERT INTO timemanage_schema_versions (version_id, is_applied, tstamp) VALUES (?, 1, NOW())`, latestSchemaVersion+1); err != nil {
		t.Fatal(err)
	}
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err == nil || !strings.Contains(err.Error(), "newer than server") {
		t.Fatalf("ahead database was not rejected: %v", err)
	}
}

func TestMySQLBackupArtifactAndRestoreValidation(t *testing.T) {
	dsn, cleanup := mysqlTestDSN(t)
	defer cleanup()
	db, err := openMySQLDB(dsn)
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ctx := context.Background()
	if err := migrateMySQLUp(ctx, db, defaultConfig()); err != nil {
		t.Fatal(err)
	}
	dir := t.TempDir()
	dumpPath := filepath.Join(dir, "mysqldump")
	mysqlPath := filepath.Join(dir, "mysql")
	if err := os.WriteFile(dumpPath, []byte("#!/bin/sh\nprintf '%s\\n' 'CREATE TABLE backup_probe (id INT);'\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(mysqlPath, []byte("#!/bin/sh\ncat >/dev/null\n"), 0o700); err != nil {
		t.Fatal(err)
	}
	cfg := defaultConfig()
	cfg.mysqlDSN = dsn
	cfg.backupDir = filepath.Join(dir, "receipts")
	cfg.mysqldumpPath = dumpPath
	cfg.mysqlPath = mysqlPath
	customOutput := filepath.Join(dir, "custom", "database.sql.gz")
	manifest, err := createMySQLBackup(ctx, db, cfg, customOutput)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.SchemaVersion != latestSchemaVersion || manifest.SizeBytes == 0 {
		t.Fatalf("unexpected manifest: %#v", manifest)
	}
	if _, err := os.Stat(manifest.FilePath + ".json"); err != nil {
		t.Fatal(err)
	}
	if err := requireRecentMigrationBackup(cfg, latestSchemaVersion); err != nil {
		t.Fatalf("custom backup did not satisfy receipt gate: %v", err)
	}
	if err := verifyRestoredDatabase(ctx, cfg, manifest); err != nil {
		t.Fatal(err)
	}
	if _, err := restoreMySQLBackup(ctx, cfg, manifest.FilePath); err != nil {
		t.Fatal(err)
	}
	file, err := os.OpenFile(manifest.FilePath, os.O_APPEND|os.O_WRONLY, 0)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := file.WriteString("changed"); err != nil {
		t.Fatal(err)
	}
	if err := file.Close(); err != nil {
		t.Fatal(err)
	}
	if _, err := restoreMySQLBackup(ctx, cfg, manifest.FilePath); err == nil {
		t.Fatal("restore accepted a changed backup")
	}
}

func assertSchemaVersion(t *testing.T, ctx context.Context, db sqlRunner, expected int64) {
	t.Helper()
	var actual int64
	if err := db.QueryRowContext(ctx, `SELECT COALESCE(MAX(version_id), 0) FROM timemanage_schema_versions WHERE is_applied = 1`).Scan(&actual); err != nil {
		t.Fatal(err)
	}
	if actual != expected {
		t.Fatalf("schema version = %d, want %d", actual, expected)
	}
}

func assertWorkspacePreserved(t *testing.T, ctx context.Context, db sqlRunner) {
	t.Helper()
	var count int
	if err := db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspaces WHERE id = 'preserved'`).Scan(&count); err != nil {
		t.Fatal(err)
	}
	if count != 1 {
		t.Fatal("baseline workspace data was not preserved")
	}
}
