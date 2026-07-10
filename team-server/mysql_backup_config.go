package main

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/go-sql-driver/mysql"
)

func writeMySQLClientFile(dsn string) (string, *mysql.Config, func(), error) {
	dsnConfig, err := mysql.ParseDSN(dsn)
	if err != nil {
		return "", nil, func() {}, err
	}
	if dsnConfig.Net != "tcp" {
		return "", nil, func() {}, fmt.Errorf("database backup and restore require a TCP MySQL DSN")
	}
	for name, value := range map[string]string{"user": dsnConfig.User, "password": dsnConfig.Passwd, "address": dsnConfig.Addr} {
		if strings.ContainsAny(value, "\r\n") {
			return "", nil, func() {}, fmt.Errorf("MySQL %s contains an unsupported newline", name)
		}
	}
	file, err := os.CreateTemp("", "timemanage-mysql-client-*.cnf")
	if err != nil {
		return "", nil, func() {}, err
	}
	cleanup := func() { _ = os.Remove(file.Name()) }
	if err := file.Chmod(0o600); err != nil {
		_ = file.Close()
		cleanup()
		return "", nil, func() {}, err
	}
	content := fmt.Sprintf(
		"[client]\nuser=\"%s\"\npassword=\"%s\"\nprotocol=TCP\nhost=\"%s\"\nport=%s\ndefault-character-set=utf8mb4\n",
		escapeMySQLOption(dsnConfig.User), escapeMySQLOption(dsnConfig.Passwd),
		escapeMySQLOption(mysqlHost(dsnConfig.Addr)), mysqlPort(dsnConfig.Addr),
	)
	if _, err := file.WriteString(content); err != nil {
		_ = file.Close()
		cleanup()
		return "", nil, func() {}, err
	}
	if err := file.Close(); err != nil {
		cleanup()
		return "", nil, func() {}, err
	}
	return file.Name(), dsnConfig, cleanup, nil
}

func escapeMySQLOption(value string) string {
	return strings.NewReplacer("\\", "\\\\", "\"", "\\\"").Replace(value)
}

func mysqlHost(address string) string {
	if index := strings.LastIndex(address, ":"); index > -1 {
		return strings.Trim(address[:index], "[]")
	}
	return address
}

func mysqlPort(address string) string {
	if index := strings.LastIndex(address, ":"); index > -1 && index < len(address)-1 {
		return address[index+1:]
	}
	return "3306"
}

func requireRecentMigrationBackup(cfg config, schemaVersion int64) error {
	paths, err := filepath.Glob(filepath.Join(cfg.backupDir, "*.json"))
	if err != nil {
		return err
	}
	sort.Sort(sort.Reverse(sort.StringSlice(paths)))
	maxAge := time.Duration(cfg.backupMaxAgeHours) * time.Hour
	now := time.Now()
	for _, path := range paths {
		manifest, err := readBackupManifest(path)
		if err != nil || manifest.SchemaVersion != schemaVersion || manifest.CreatedAt.IsZero() ||
			manifest.CreatedAt.After(now.Add(5*time.Minute)) || now.Sub(manifest.CreatedAt) > maxAge {
			continue
		}
		checksum, size, err := fileChecksum(manifest.FilePath)
		if err == nil && checksum == manifest.SHA256 && size == manifest.SizeBytes {
			return nil
		}
	}
	return fmt.Errorf("pending database migration requires a verified backup no older than %d hours; run `timemanage-team db backup` first", cfg.backupMaxAgeHours)
}

func recordDatabaseBackup(ctx context.Context, db *sql.DB, manifest databaseBackupManifest) error {
	exists, err := mysqlSchemaTableExists(ctx, db, "timemanage_database_backups")
	if err != nil || !exists {
		return err
	}
	_, err = db.ExecContext(ctx, `INSERT INTO timemanage_database_backups
		(schema_version, release_version, file_path, sha256, size_bytes, created_at)
		VALUES (?, ?, ?, ?, ?, ?)`, manifest.SchemaVersion, manifest.ReleaseVersion,
		manifest.FilePath, manifest.SHA256, manifest.SizeBytes, manifest.CreatedAt)
	return err
}

func mysqlSchemaTableExists(ctx context.Context, db *sql.DB, tableName string) (bool, error) {
	var count int
	err := db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
		tableName,
	).Scan(&count)
	return count > 0, err
}
