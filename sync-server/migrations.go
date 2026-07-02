package main

import (
	"bytes"
	"context"
	"crypto/sha256"
	"database/sql"
	"embed"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log"
	"net"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

const migrationTableDDL = `CREATE TABLE IF NOT EXISTS schema_migrations (
	id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
	version VARCHAR(32) NOT NULL,
	name VARCHAR(255) NOT NULL,
	checksum VARCHAR(64) NOT NULL,
	direction VARCHAR(8) NOT NULL,
	applied_at VARCHAR(40) NOT NULL,
	duration_ms BIGINT NOT NULL,
	app_version VARCHAR(64) NOT NULL,
	success TINYINT(1) NOT NULL,
	error_message TEXT NULL,
	KEY idx_schema_migrations_version (version),
	KEY idx_schema_migrations_success (success)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`

var appVersion = "dev"

//go:embed migrations/*.sql
var mysqlMigrationFiles embed.FS

type mysqlMigration struct {
	Version string
	Name    string
	UpSQL   string
	DownSQL string
}

type mysqlMigrationRecord struct {
	ID           int64
	Version      string
	Name         string
	Checksum     string
	Direction    string
	AppliedAt    string
	DurationMs   int64
	AppVersion   string
	Success      bool
	ErrorMessage string
}

func runMigrateCommand(ctx context.Context, cfg config) error {
	action := fallback(cfg.migrateAction, "status")
	if action == "backup" {
		output, err := backupMySQLDatabase(ctx, cfg.mysqlDSN, cfg.migrateOutput)
		if err != nil {
			return err
		}
		log.Printf("MySQL backup written to %s", output)
		return nil
	}
	if action == "restore" {
		if err := restoreMySQLDatabase(ctx, cfg.mysqlDSN, cfg.migrateInput); err != nil {
			return err
		}
		log.Printf("MySQL backup restored from %s", cfg.migrateInput)
		return nil
	}
	db, err := openMySQLDB(cfg.mysqlDSN)
	if err != nil {
		return err
	}
	defer db.Close()

	switch action {
	case "status":
		return printMySQLMigrationStatus(ctx, db)
	case "up":
		return applyMySQLMigrations(ctx, db)
	case "down":
		if cfg.migrateTo == "" {
			return errors.New("migrate down requires --to VERSION")
		}
		return rollbackMySQLMigrations(ctx, db, cfg.migrateTo)
	case "verify":
		return verifyMySQLMigrations(ctx, db)
	default:
		return fmt.Errorf("unknown migrate action %q; use status, up, down, backup, restore or verify", action)
	}
}

func applyMySQLMigrations(ctx context.Context, db *sql.DB) error {
	migrations, err := loadMySQLMigrations()
	if err != nil {
		return err
	}
	if err := ensureMySQLMigrationTable(ctx, db); err != nil {
		return err
	}
	records, err := latestMySQLMigrationRecords(ctx, db)
	if err != nil {
		return err
	}
	for _, migration := range migrations {
		record := records[migration.Version]
		if record.ID != 0 && !record.Success {
			return fmt.Errorf("schema migration %s is dirty: %s", migration.Version, record.ErrorMessage)
		}
		if record.Success && record.Direction == "up" {
			if record.Checksum != checksumMigration(migration) {
				return fmt.Errorf("schema migration %s checksum changed; refuse to start", migration.Version)
			}
			continue
		}
		if err := applySingleMySQLMigration(ctx, db, migration, "up"); err != nil {
			return err
		}
	}
	return nil
}

func rollbackMySQLMigrations(ctx context.Context, db *sql.DB, targetVersion string) error {
	migrations, err := loadMySQLMigrations()
	if err != nil {
		return err
	}
	if err := ensureMySQLMigrationTable(ctx, db); err != nil {
		return err
	}
	records, err := latestMySQLMigrationRecords(ctx, db)
	if err != nil {
		return err
	}
	if targetVersion != "0" && !migrationVersionExists(migrations, targetVersion) {
		return fmt.Errorf("target migration version %s is unknown", targetVersion)
	}
	for i := len(migrations) - 1; i >= 0; i-- {
		migration := migrations[i]
		record := records[migration.Version]
		if record.ID != 0 && !record.Success {
			return fmt.Errorf("schema migration %s is dirty: %s", migration.Version, record.ErrorMessage)
		}
		if !record.Success || record.Direction != "up" || migration.Version <= targetVersion {
			continue
		}
		if strings.TrimSpace(migration.DownSQL) == "" {
			return fmt.Errorf("schema migration %s has no down migration; restore a database backup to roll back this version", migration.Version)
		}
		if err := applySingleMySQLMigration(ctx, db, migration, "down"); err != nil {
			return err
		}
	}
	return nil
}

func verifyMySQLMigrations(ctx context.Context, db *sql.DB) error {
	migrations, err := loadMySQLMigrations()
	if err != nil {
		return err
	}
	if err := ensureMySQLMigrationTable(ctx, db); err != nil {
		return err
	}
	records, err := latestMySQLMigrationRecords(ctx, db)
	if err != nil {
		return err
	}
	for _, migration := range migrations {
		record := records[migration.Version]
		if record.ID == 0 || !record.Success || record.Direction != "up" {
			return fmt.Errorf("schema migration %s is pending", migration.Version)
		}
		if record.Checksum != checksumMigration(migration) {
			return fmt.Errorf("schema migration %s checksum changed", migration.Version)
		}
	}
	for _, check := range []struct {
		Table  string
		Column string
	}{
		{"schema_migrations", "version"},
		{"sync_meta", "key_name"},
		{"workspaces", "type"},
		{"workspaces", "owner_account_id"},
		{"workspace_memberships", "account_id"},
		{"workspace_invitations", "invitee_account_id"},
		{"project_invitations", "project_id"},
		{"project_invitations", "roles_json"},
		{"sync_rows", "revision"},
		{"team_tasks", "payload"},
	} {
		ok, err := mysqlColumnExists(ctx, db, check.Table, check.Column)
		if err != nil {
			return err
		}
		if !ok {
			return fmt.Errorf("database schema verification failed: %s.%s is missing", check.Table, check.Column)
		}
	}
	return nil
}

func printMySQLMigrationStatus(ctx context.Context, db *sql.DB) error {
	migrations, err := loadMySQLMigrations()
	if err != nil {
		return err
	}
	if err := ensureMySQLMigrationTable(ctx, db); err != nil {
		return err
	}
	records, err := latestMySQLMigrationRecords(ctx, db)
	if err != nil {
		return err
	}
	applied := 0
	pending := 0
	dirty := 0
	for _, migration := range migrations {
		record := records[migration.Version]
		state := "pending"
		if record.ID != 0 && !record.Success {
			state = "dirty"
			dirty++
		} else if record.Success && record.Direction == "up" {
			state = "applied"
			applied++
		} else {
			pending++
		}
		fmt.Printf("%s %s %s\n", migration.Version, state, migration.Name)
	}
	fmt.Printf("summary applied=%d pending=%d dirty=%d\n", applied, pending, dirty)
	return nil
}

func applySingleMySQLMigration(ctx context.Context, db *sql.DB, migration mysqlMigration, direction string) error {
	started := time.Now()
	sqlText := migration.UpSQL
	if direction == "down" {
		sqlText = migration.DownSQL
	}
	err := execMySQLStatements(ctx, db, sqlText)
	if err == nil && direction == "up" {
		err = applyMySQLMigrationHook(ctx, db, migration.Version)
	}
	duration := time.Since(started).Milliseconds()
	if recordErr := insertMySQLMigrationRecord(ctx, db, migration, direction, duration, err); recordErr != nil {
		if err != nil {
			return fmt.Errorf("%w; additionally failed to record migration result: %v", err, recordErr)
		}
		return recordErr
	}
	if err != nil {
		return fmt.Errorf("apply schema migration %s %s: %w", migration.Version, direction, err)
	}
	log.Printf("Applied schema migration %s %s (%s)", migration.Version, direction, migration.Name)
	return nil
}

func applyMySQLMigrationHook(ctx context.Context, db *sql.DB, version string) error {
	switch version {
	case "202607010001":
		if err := ensureMySQLColumn(ctx, db, "workspaces", "type", `ALTER TABLE workspaces ADD COLUMN type VARCHAR(24) NOT NULL DEFAULT 'shared' AFTER name`); err != nil {
			return err
		}
		if err := ensureMySQLColumn(ctx, db, "workspaces", "owner_account_id", `ALTER TABLE workspaces ADD COLUMN owner_account_id VARCHAR(128) NULL AFTER type`); err != nil {
			return err
		}
		if err := ensureMySQLIndex(ctx, db, "workspaces", "idx_workspaces_owner", `ALTER TABLE workspaces ADD KEY idx_workspaces_owner (owner_account_id)`); err != nil {
			return err
		}
		if err := ensureMySQLIndex(ctx, db, "workspaces", "idx_workspaces_type", `ALTER TABLE workspaces ADD KEY idx_workspaces_type (type)`); err != nil {
			return err
		}
		return migrateMySQLWorkspaces(ctx, db)
	default:
		return nil
	}
}

func ensureMySQLMigrationTable(ctx context.Context, db *sql.DB) error {
	_, err := db.ExecContext(ctx, migrationTableDDL)
	return err
}

func latestMySQLMigrationRecords(ctx context.Context, db *sql.DB) (map[string]mysqlMigrationRecord, error) {
	rows, err := db.QueryContext(ctx, `SELECT id, version, name, checksum, direction, applied_at, duration_ms, app_version, success, error_message FROM schema_migrations ORDER BY id ASC`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	records := map[string]mysqlMigrationRecord{}
	for rows.Next() {
		var record mysqlMigrationRecord
		var success int
		var errorMessage sql.NullString
		if err := rows.Scan(&record.ID, &record.Version, &record.Name, &record.Checksum, &record.Direction, &record.AppliedAt, &record.DurationMs, &record.AppVersion, &success, &errorMessage); err != nil {
			return nil, err
		}
		record.Success = success == 1
		if errorMessage.Valid {
			record.ErrorMessage = errorMessage.String
		}
		records[record.Version] = record
	}
	return records, rows.Err()
}

func insertMySQLMigrationRecord(ctx context.Context, db *sql.DB, migration mysqlMigration, direction string, durationMs int64, applyErr error) error {
	success := 1
	var errorMessage sql.NullString
	if applyErr != nil {
		success = 0
		errorMessage = sql.NullString{String: applyErr.Error(), Valid: true}
	}
	_, err := db.ExecContext(
		ctx,
		`INSERT INTO schema_migrations (version, name, checksum, direction, applied_at, duration_ms, app_version, success, error_message)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		migration.Version,
		migration.Name,
		checksumMigration(migration),
		direction,
		time.Now().UTC().Format(time.RFC3339),
		durationMs,
		appVersion,
		success,
		errorMessage,
	)
	return err
}

func loadMySQLMigrations() ([]mysqlMigration, error) {
	entries, err := mysqlMigrationFiles.ReadDir("migrations")
	if err != nil {
		return nil, err
	}
	byVersion := map[string]*mysqlMigration{}
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}
		name := entry.Name()
		direction := ""
		switch {
		case strings.HasSuffix(name, ".up.sql"):
			direction = "up"
		case strings.HasSuffix(name, ".down.sql"):
			direction = "down"
		default:
			continue
		}
		version, migrationName, ok := parseMigrationFilename(name, direction)
		if !ok {
			return nil, fmt.Errorf("invalid migration filename %s", name)
		}
		bytes, err := mysqlMigrationFiles.ReadFile(filepath.ToSlash(filepath.Join("migrations", name)))
		if err != nil {
			return nil, err
		}
		migration := byVersion[version]
		if migration == nil {
			migration = &mysqlMigration{Version: version, Name: migrationName}
			byVersion[version] = migration
		}
		if migration.Name != migrationName {
			return nil, fmt.Errorf("migration %s has inconsistent names: %s and %s", version, migration.Name, migrationName)
		}
		if direction == "up" {
			migration.UpSQL = string(bytes)
		} else {
			migration.DownSQL = string(bytes)
		}
	}
	migrations := make([]mysqlMigration, 0, len(byVersion))
	for _, migration := range byVersion {
		if strings.TrimSpace(migration.UpSQL) == "" {
			return nil, fmt.Errorf("migration %s is missing up.sql", migration.Version)
		}
		migrations = append(migrations, *migration)
	}
	sort.Slice(migrations, func(i, j int) bool {
		return migrations[i].Version < migrations[j].Version
	})
	return migrations, nil
}

func parseMigrationFilename(name string, direction string) (string, string, bool) {
	suffix := "." + direction + ".sql"
	trimmed := strings.TrimSuffix(name, suffix)
	parts := strings.SplitN(trimmed, "_", 2)
	if len(parts) != 2 || parts[0] == "" || parts[1] == "" {
		return "", "", false
	}
	return parts[0], parts[1], true
}

func migrationVersionExists(migrations []mysqlMigration, version string) bool {
	for _, migration := range migrations {
		if migration.Version == version {
			return true
		}
	}
	return false
}

func checksumMigration(migration mysqlMigration) string {
	hash := sha256.Sum256([]byte(migration.Version + "\n" + migration.Name + "\n" + migration.UpSQL + "\n" + migration.DownSQL))
	return hex.EncodeToString(hash[:])
}

func execMySQLStatements(ctx context.Context, db *sql.DB, sqlText string) error {
	for _, statement := range splitSQLStatements(sqlText) {
		if _, err := db.ExecContext(ctx, statement); err != nil {
			return err
		}
	}
	return nil
}

func splitSQLStatements(sqlText string) []string {
	lines := strings.Split(sqlText, "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		if strings.HasPrefix(strings.TrimSpace(line), "--") {
			continue
		}
		cleaned = append(cleaned, line)
	}
	parts := strings.Split(strings.Join(cleaned, "\n"), ";")
	statements := make([]string, 0, len(parts))
	for _, part := range parts {
		statement := strings.TrimSpace(part)
		if statement != "" {
			statements = append(statements, statement)
		}
	}
	return statements
}

func mysqlColumnExists(ctx context.Context, db *sql.DB, tableName string, columnName string) (bool, error) {
	var count int
	if err := db.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
		tableName,
		columnName,
	).Scan(&count); err != nil {
		return false, err
	}
	return count > 0, nil
}

func backupMySQLDatabase(ctx context.Context, dsn string, outputPath string) (string, error) {
	if strings.TrimSpace(dsn) == "" {
		return "", errors.New("mysql_dsn is required")
	}
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return "", err
	}
	if cfg.DBName == "" {
		return "", errors.New("mysql_dsn must include a database name")
	}
	if strings.TrimSpace(outputPath) == "" {
		outputPath = filepath.Join("backups", "timemanage-sync-"+time.Now().Format("20060102-150405")+".sql")
	}
	if err := os.MkdirAll(filepath.Dir(outputPath), 0o755); err != nil {
		return "", err
	}
	file, err := os.Create(outputPath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	args := []string{"--single-transaction", "--quick", "--routines", "--triggers", "--events", "--default-character-set=utf8mb4"}
	if cfg.Net == "tcp" || cfg.Addr != "" {
		host := cfg.Addr
		port := ""
		if splitHost, splitPort, err := net.SplitHostPort(cfg.Addr); err == nil {
			host = splitHost
			port = splitPort
		}
		if host != "" {
			args = append(args, "--host="+host)
		}
		if port != "" {
			args = append(args, "--port="+port)
		}
	}
	if cfg.User != "" {
		args = append(args, "--user="+cfg.User)
	}
	if cfg.Passwd != "" {
		args = append(args, "--password="+cfg.Passwd)
	}
	args = append(args, "--databases", cfg.DBName)

	cmd := exec.CommandContext(ctx, "mysqldump", args...)
	cmd.Stdout = file
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		_ = file.Close()
		_ = os.Remove(outputPath)
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return "", fmt.Errorf("mysqldump failed: %s", message)
	}
	if _, err := file.Seek(0, io.SeekEnd); err != nil {
		return "", err
	}
	return outputPath, nil
}

func restoreMySQLDatabase(ctx context.Context, dsn string, inputPath string) error {
	if strings.TrimSpace(dsn) == "" {
		return errors.New("mysql_dsn is required")
	}
	if strings.TrimSpace(inputPath) == "" {
		return errors.New("migrate restore requires --input")
	}
	cfg, err := mysql.ParseDSN(dsn)
	if err != nil {
		return err
	}
	file, err := os.Open(inputPath)
	if err != nil {
		return err
	}
	defer file.Close()

	args := []string{"--default-character-set=utf8mb4", "--binary-mode=1"}
	if cfg.Net == "tcp" || cfg.Addr != "" {
		host := cfg.Addr
		port := ""
		if splitHost, splitPort, err := net.SplitHostPort(cfg.Addr); err == nil {
			host = splitHost
			port = splitPort
		}
		if host != "" {
			args = append(args, "--host="+host)
		}
		if port != "" {
			args = append(args, "--port="+port)
		}
	}
	if cfg.User != "" {
		args = append(args, "--user="+cfg.User)
	}
	if cfg.Passwd != "" {
		args = append(args, "--password="+cfg.Passwd)
	}

	cmd := exec.CommandContext(ctx, "mysql", args...)
	cmd.Stdin = file
	var stderr bytes.Buffer
	cmd.Stderr = &stderr
	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(stderr.String())
		if message == "" {
			message = err.Error()
		}
		return fmt.Errorf("mysql restore failed: %s", message)
	}
	return nil
}
