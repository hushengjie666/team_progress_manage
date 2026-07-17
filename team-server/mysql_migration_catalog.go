package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strings"
)

const (
	baselineSchemaVersion int64 = 1
	latestSchemaVersion   int64 = 7
	serverReleaseVersion        = "v0.2.4"
)

type migrationDefinition struct {
	SchemaVersion  int64
	ReleaseVersion string
	FileName       string
	RequiresBackup bool
	RestoreOnly    bool
}

var migrationCatalog = []migrationDefinition{
	{SchemaVersion: 1, ReleaseVersion: "v0.1.2", FileName: "00001_v0_1_2_baseline.sql"},
	{SchemaVersion: 2, ReleaseVersion: "v0.1.3", FileName: "00002_v0_1_3_noop.sql"},
	{SchemaVersion: 3, ReleaseVersion: "v0.2.0", FileName: "00003_v0_2_0_noop.sql"},
	{SchemaVersion: 4, ReleaseVersion: "v0.2.1", FileName: "00004_v0_2_1_noop.sql"},
	{SchemaVersion: 5, ReleaseVersion: "v0.2.2", FileName: "00005_v0_2_2_migration_framework.sql"},
	{SchemaVersion: 6, ReleaseVersion: "v0.2.3", FileName: "00006_v0_2_3_concurrency_guards.sql"},
	{SchemaVersion: 7, ReleaseVersion: serverReleaseVersion, FileName: "00007_v0_2_4_server_authoritative_domain_api.sql"},
}

func migrationForRelease(release string) (migrationDefinition, error) {
	normalized := strings.TrimSpace(strings.ToLower(release))
	if normalized != "" && !strings.HasPrefix(normalized, "v") {
		normalized = "v" + normalized
	}
	for _, migration := range migrationCatalog {
		if strings.ToLower(migration.ReleaseVersion) == normalized {
			return migration, nil
		}
	}
	return migrationDefinition{}, fmt.Errorf("unknown release %q; supported range is v0.1.2 through %s", release, serverReleaseVersion)
}

func migrationForSchemaVersion(version int64) (migrationDefinition, error) {
	for _, migration := range migrationCatalog {
		if migration.SchemaVersion == version {
			return migration, nil
		}
	}
	return migrationDefinition{}, fmt.Errorf("unknown schema version %d", version)
}

func migrationChecksum(migration migrationDefinition) (string, error) {
	content, err := embeddedMigrations.ReadFile("migrations/" + migration.FileName)
	if err != nil {
		return "", err
	}
	digest := sha256.Sum256(content)
	return hex.EncodeToString(digest[:]), nil
}

func pendingMigrationNeedsBackup(currentVersion int64, targetVersion int64) bool {
	for _, migration := range migrationCatalog {
		if migration.SchemaVersion > currentVersion && migration.SchemaVersion <= targetVersion && migration.RequiresBackup {
			return true
		}
	}
	return false
}

func migrationsBetween(currentVersion int64, targetVersion int64) []migrationDefinition {
	pending := []migrationDefinition{}
	for _, migration := range migrationCatalog {
		if migration.SchemaVersion > currentVersion && migration.SchemaVersion <= targetVersion {
			pending = append(pending, migration)
		}
	}
	return pending
}

func rollbackRequiresRestore(currentVersion int64, targetVersion int64) bool {
	for _, migration := range migrationCatalog {
		if migration.SchemaVersion > targetVersion && migration.SchemaVersion <= currentVersion && migration.RestoreOnly {
			return true
		}
	}
	return false
}
