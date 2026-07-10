package main

import (
	"context"
	"database/sql"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"time"

	"github.com/pressly/goose/v3"
	"github.com/pressly/goose/v3/database"
)

const migrationVersionTable = "timemanage_schema_versions"

//go:embed migrations/*.sql
var embeddedMigrations embed.FS

func newMigrationProvider(db *sql.DB) (*goose.Provider, error) {
	migrations, err := fs.Sub(embeddedMigrations, "migrations")
	if err != nil {
		return nil, err
	}
	store, err := database.NewStore(database.DialectMySQL, migrationVersionTable)
	if err != nil {
		return nil, err
	}
	return goose.NewProvider("", db, migrations, goose.WithStore(store))
}

func migrateMySQLUp(ctx context.Context, db *sql.DB, cfg config) error {
	return withMigrationLock(ctx, db, func() error {
		provider, err := newMigrationProvider(db)
		if err != nil {
			return err
		}
		currentVersion, err := provider.GetDBVersion(ctx)
		if err != nil {
			return fmt.Errorf("read schema version: %w", err)
		}
		if currentVersion > latestSchemaVersion {
			return fmt.Errorf("database schema version %d is newer than server %s supports (%d)", currentVersion, serverReleaseVersion, latestSchemaVersion)
		}
		if pendingMigrationNeedsBackup(currentVersion, latestSchemaVersion) {
			if err := requireRecentMigrationBackup(cfg, currentVersion); err != nil {
				return err
			}
		}
		if _, err := provider.Up(ctx); err != nil {
			return fmt.Errorf("upgrade database schema: %w", err)
		}
		if err := normalizeMySQLSchema(ctx, db); err != nil {
			return fmt.Errorf("normalize database schema: %w", err)
		}
		if err := verifyMigrationIntegrity(ctx, db, latestSchemaVersion); err != nil {
			return err
		}
		return nil
	})
}

func migrateMySQLDown(ctx context.Context, db *sql.DB, targetVersion int64) error {
	if targetVersion < baselineSchemaVersion {
		return fmt.Errorf("rollback below v0.1.2 is not supported")
	}
	return withMigrationLock(ctx, db, func() error {
		provider, err := newMigrationProvider(db)
		if err != nil {
			return err
		}
		currentVersion, err := provider.GetDBVersion(ctx)
		if err != nil {
			return fmt.Errorf("read schema version: %w", err)
		}
		if targetVersion > currentVersion {
			return fmt.Errorf("target schema version %d is newer than current version %d", targetVersion, currentVersion)
		}
		if currentVersion > latestSchemaVersion {
			return fmt.Errorf("database schema version %d is newer than server %s supports (%d)", currentVersion, serverReleaseVersion, latestSchemaVersion)
		}
		if rollbackRequiresRestore(currentVersion, targetVersion) {
			return errors.New("rollback crosses a restore-only migration; restore a verified database backup instead")
		}
		if _, err := provider.DownTo(ctx, targetVersion); err != nil {
			return fmt.Errorf("rollback database schema: %w", err)
		}
		return nil
	})
}

func currentSchemaVersion(ctx context.Context, db *sql.DB) (int64, error) {
	provider, err := newMigrationProvider(db)
	if err != nil {
		return 0, err
	}
	return provider.GetDBVersion(ctx)
}

func withMigrationLock(ctx context.Context, db *sql.DB, run func() error) error {
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	var databaseName string
	if err := conn.QueryRowContext(ctx, "SELECT DATABASE()").Scan(&databaseName); err != nil {
		return err
	}
	lockName := "timemanage:" + databaseName + ":schema"
	var acquired sql.NullInt64
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, ?)", lockName, 30).Scan(&acquired); err != nil {
		return fmt.Errorf("acquire database migration lock: %w", err)
	}
	if !acquired.Valid || acquired.Int64 != 1 {
		return errors.New("timed out waiting for database migration lock")
	}
	defer func() {
		releaseCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_, _ = conn.ExecContext(releaseCtx, "SELECT RELEASE_LOCK(?)", lockName)
	}()
	return run()
}
