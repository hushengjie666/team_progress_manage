package main

import (
	"context"
	"database/sql"
	"fmt"
)

func verifyMigrationIntegrity(ctx context.Context, db *sql.DB, currentVersion int64) error {
	for _, migration := range migrationCatalog {
		if migration.SchemaVersion > currentVersion {
			continue
		}
		expected, err := migrationChecksum(migration)
		if err != nil {
			return fmt.Errorf("checksum migration %d: %w", migration.SchemaVersion, err)
		}
		var recorded string
		err = db.QueryRowContext(
			ctx,
			"SELECT sha256 FROM timemanage_migration_integrity WHERE migration_version = ?",
			migration.SchemaVersion,
		).Scan(&recorded)
		switch {
		case err == sql.ErrNoRows:
			_, err = db.ExecContext(
				ctx,
				`INSERT INTO timemanage_migration_integrity (migration_version, release_version, sha256) VALUES (?, ?, ?)`,
				migration.SchemaVersion,
				migration.ReleaseVersion,
				expected,
			)
			if err != nil {
				return fmt.Errorf("record migration %d checksum: %w", migration.SchemaVersion, err)
			}
		case err != nil:
			return fmt.Errorf("read migration %d checksum: %w", migration.SchemaVersion, err)
		case recorded != expected:
			return fmt.Errorf("migration %d checksum mismatch: applied SQL was changed after release", migration.SchemaVersion)
		}
	}
	return nil
}
