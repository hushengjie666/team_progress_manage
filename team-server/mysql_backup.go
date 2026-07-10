package main

import (
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type databaseBackupManifest struct {
	SchemaVersion  int64     `json:"schema_version"`
	ReleaseVersion string    `json:"release_version"`
	DatabaseName   string    `json:"database_name"`
	FilePath       string    `json:"file_path"`
	SHA256         string    `json:"sha256"`
	SizeBytes      int64     `json:"size_bytes"`
	CreatedAt      time.Time `json:"created_at"`
}

func createMySQLBackup(ctx context.Context, db *sql.DB, cfg config, outputPath string) (databaseBackupManifest, error) {
	version, err := currentSchemaVersion(ctx, db)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	manifestVersion := version
	if manifestVersion == 0 {
		manifestVersion = baselineSchemaVersion
	}
	migration, err := migrationForSchemaVersion(manifestVersion)
	if err != nil {
		return databaseBackupManifest{}, fmt.Errorf("database schema version %d cannot be backed up by server %s", version, serverReleaseVersion)
	}
	release := migration.ReleaseVersion
	if outputPath == "" {
		name := fmt.Sprintf("timemanage-db-%s-%s.sql.gz", strings.TrimPrefix(release, "v"), time.Now().Format("20060102-150405-000"))
		outputPath = filepath.Join(cfg.backupDir, name)
	}
	absPath, err := filepath.Abs(outputPath)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	if err := os.MkdirAll(filepath.Dir(absPath), 0o700); err != nil {
		return databaseBackupManifest{}, err
	}
	clientFile, dsnConfig, cleanup, err := writeMySQLClientFile(cfg.mysqlDSN)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	defer cleanup()

	file, err := os.OpenFile(absPath, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0o600)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	hash := sha256.New()
	gzipWriter := gzip.NewWriter(io.MultiWriter(file, hash))
	args := []string{
		"--defaults-extra-file=" + clientFile,
		"--single-transaction", "--routines", "--triggers", "--events", "--hex-blob",
		"--set-gtid-purged=OFF",
	}
	if commandSupportsOption(ctx, cfg.mysqldumpPath, "column-statistics") {
		args = append(args, "--column-statistics=0")
	}
	args = append(args, dsnConfig.DBName)
	command := exec.CommandContext(ctx, cfg.mysqldumpPath, args...)
	var stderr bytes.Buffer
	command.Stdout = gzipWriter
	command.Stderr = &stderr
	runErr := command.Run()
	closeErr := gzipWriter.Close()
	fileErr := file.Close()
	if runErr != nil || closeErr != nil || fileErr != nil {
		_ = os.Remove(absPath)
		return databaseBackupManifest{}, commandFailure("mysqldump", runErr, closeErr, fileErr, stderr.String())
	}
	stat, err := os.Stat(absPath)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	manifest := databaseBackupManifest{
		SchemaVersion: manifestVersion, ReleaseVersion: release, DatabaseName: dsnConfig.DBName, FilePath: absPath,
		SHA256: hex.EncodeToString(hash.Sum(nil)), SizeBytes: stat.Size(), CreatedAt: time.Now().UTC(),
	}
	if err := writeBackupManifest(cfg, manifest); err != nil {
		return databaseBackupManifest{}, err
	}
	if err := recordDatabaseBackup(ctx, db, manifest); err != nil {
		return databaseBackupManifest{}, err
	}
	return manifest, nil
}

func restoreMySQLBackup(ctx context.Context, cfg config, inputPath string) (databaseBackupManifest, error) {
	absPath, err := filepath.Abs(inputPath)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	manifest, err := readBackupManifest(absPath + ".json")
	if err != nil {
		return databaseBackupManifest{}, fmt.Errorf("read backup manifest: %w", err)
	}
	migration, err := migrationForRelease(manifest.ReleaseVersion)
	if err != nil || migration.SchemaVersion != manifest.SchemaVersion || manifest.DatabaseName == "" {
		return databaseBackupManifest{}, fmt.Errorf("backup manifest has an unsupported release/schema pair")
	}
	checksum, size, err := fileChecksum(absPath)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	if checksum != manifest.SHA256 || size != manifest.SizeBytes {
		return databaseBackupManifest{}, fmt.Errorf("backup checksum or size does not match its manifest")
	}
	clientFile, dsnConfig, cleanup, err := writeMySQLClientFile(cfg.mysqlDSN)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	defer cleanup()
	if dsnConfig.DBName != manifest.DatabaseName {
		return databaseBackupManifest{}, fmt.Errorf("backup database %q does not match configured database %q", manifest.DatabaseName, dsnConfig.DBName)
	}
	if _, err := exec.LookPath(cfg.mysqlPath); err != nil {
		return databaseBackupManifest{}, fmt.Errorf("find mysql client: %w", err)
	}
	file, err := os.Open(absPath)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	defer file.Close()
	gzipReader, err := gzip.NewReader(file)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	defer gzipReader.Close()
	if err := resetMySQLDatabase(cfg.mysqlDSN); err != nil {
		return databaseBackupManifest{}, fmt.Errorf("reset target database: %w", err)
	}
	command := exec.CommandContext(ctx, cfg.mysqlPath, "--defaults-extra-file="+clientFile, "--database="+dsnConfig.DBName)
	var stderr bytes.Buffer
	command.Stdin = gzipReader
	command.Stderr = &stderr
	if err := command.Run(); err != nil {
		return databaseBackupManifest{}, fmt.Errorf("mysql restore failed: %w: %s", err, strings.TrimSpace(stderr.String()))
	}
	return manifest, nil
}

func commandFailure(name string, errorsToCheck ...any) error {
	parts := []string{}
	for _, value := range errorsToCheck {
		switch typed := value.(type) {
		case error:
			if typed != nil {
				parts = append(parts, typed.Error())
			}
		case string:
			if strings.TrimSpace(typed) != "" {
				parts = append(parts, strings.TrimSpace(typed))
			}
		}
	}
	return fmt.Errorf("%s failed: %s", name, strings.Join(parts, ": "))
}

func writeBackupManifest(cfg config, manifest databaseBackupManifest) error {
	content, err := json.MarshalIndent(manifest, "", "  ")
	if err != nil {
		return err
	}
	content = append(content, '\n')
	if err := os.WriteFile(manifest.FilePath+".json", content, 0o600); err != nil {
		return err
	}
	backupDir, err := filepath.Abs(cfg.backupDir)
	if err != nil {
		return err
	}
	if filepath.Clean(filepath.Dir(manifest.FilePath)) == filepath.Clean(backupDir) {
		return nil
	}
	if err := os.MkdirAll(backupDir, 0o700); err != nil {
		return err
	}
	receiptPath := filepath.Join(backupDir, "receipt-"+manifest.SHA256+".json")
	return os.WriteFile(receiptPath, content, 0o600)
}

func commandSupportsOption(ctx context.Context, executable string, option string) bool {
	command := exec.CommandContext(ctx, executable, "--help")
	output, err := command.CombinedOutput()
	return err == nil && bytes.Contains(output, []byte(option))
}

func readBackupManifest(path string) (databaseBackupManifest, error) {
	content, err := os.ReadFile(path)
	if err != nil {
		return databaseBackupManifest{}, err
	}
	var manifest databaseBackupManifest
	if err := json.Unmarshal(content, &manifest); err != nil {
		return databaseBackupManifest{}, err
	}
	return manifest, nil
}

func fileChecksum(path string) (string, int64, error) {
	file, err := os.Open(path)
	if err != nil {
		return "", 0, err
	}
	defer file.Close()
	hash := sha256.New()
	size, err := io.Copy(hash, file)
	if err != nil {
		return "", 0, err
	}
	return hex.EncodeToString(hash.Sum(nil)), size, nil
}
