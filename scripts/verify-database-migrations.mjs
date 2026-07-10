import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const packageVersion = JSON.parse(readFileSync(join(rootDir, "package.json"), "utf8")).version;
const migrationDir = join(rootDir, "team-server", "migrations");
const catalogSource = readFileSync(join(rootDir, "team-server", "mysql_migration_catalog.go"), "utf8");
const files = readdirSync(migrationDir).filter((name) => name.endsWith(".sql")).sort();

if (files.length === 0) {
  throw new Error("No database migration SQL files were found.");
}

files.forEach((file, index) => {
  const match = file.match(/^(\d{5})_v(\d+)_(\d+)_(\d+)_[a-z0-9_]+\.sql$/);
  if (!match) {
    throw new Error(`Invalid migration filename: ${file}`);
  }
  const expectedSequence = String(index + 1).padStart(5, "0");
  if (match[1] !== expectedSequence) {
    throw new Error(`Migration sequence must be contiguous: expected ${expectedSequence}, found ${match[1]}.`);
  }
  const content = readFileSync(join(migrationDir, file), "utf8");
  if (!content.includes("-- +goose Up") || !content.includes("-- +goose Down")) {
    throw new Error(`Migration must include Goose Up and Down sections: ${file}`);
  }
  if (!catalogSource.includes(`FileName: "${file}"`)) {
    throw new Error(`Migration is missing from mysql_migration_catalog.go: ${file}`);
  }
});

const latestFile = files.at(-1);
const expectedVersionToken = `v${packageVersion.replaceAll(".", "_")}_`;
if (!latestFile.includes(expectedVersionToken)) {
  throw new Error(`Latest migration ${latestFile} is not aligned with package version ${packageVersion}.`);
}

console.log(`Database migration audit passed: ${files.length} releases through v${packageVersion}`);
