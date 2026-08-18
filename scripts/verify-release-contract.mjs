import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const read = (path) => readFileSync(join(rootDir, path), "utf8");
const readJson = (path) => JSON.parse(read(path));
const contract = readJson("release-contract.json");

const requiredString = (value, label) => {
  if (typeof value !== "string" || !/^\d+\.\d+\.\d+$/.test(value)) {
    throw new Error(`${label} must be a stable semantic version.`);
  }
  return value;
};
const requiredInteger = (value, label) => {
  if (!Number.isInteger(value) || value < 1) throw new Error(`${label} must be a positive integer.`);
  return value;
};

const releaseVersion = requiredString(contract.release_version, "release_version");
const apiProtocolVersion = requiredInteger(contract.api_protocol_version, "api_protocol_version");
const databaseSchemaVersion = requiredInteger(contract.database_schema_version, "database_schema_version");
const minimumClientRelease = requiredString(contract.minimum_client_release, "minimum_client_release");

if (minimumClientRelease !== releaseVersion) {
  throw new Error("minimum_client_release must equal release_version for this strict release contract.");
}

const extract = (source, pattern, label) => {
  const value = source.match(pattern)?.[1];
  if (!value) throw new Error(`Unable to read ${label}.`);
  return value;
};

const packageJson = readJson("package.json");
const tauriConfig = readJson("src-tauri/tauri.conf.json");
const pluginManifest = readJson("plugins/timemanage/.codex-plugin/plugin.json");
const cargoSource = read("src-tauri/Cargo.toml");
const cliSource = read("cli/src/program.ts");
const pluginBundleSource = read("plugins/timemanage/scripts/timemanage.mjs");
const bootstrapSource = read("scripts/bootstrap-timemanage-codex.mjs");
const frontendSource = read("src/releaseContract.ts");
const backendSource = read("team-server/release_contract.go");
const migrationCatalog = read("team-server/mysql_migration_catalog.go");
const iosProjectSource = read("src-tauri/gen/apple/project.yml");
const iosXcodeSource = read("src-tauri/gen/apple/timemanage-desktop.xcodeproj/project.pbxproj");
const iosAppInfoSource = read("src-tauri/gen/apple/timemanage-desktop_iOS/Info.plist");
const iosExtensionInfoSource = read("src-tauri/gen/apple/TimerLiveActivity/Info.plist");

const versions = {
  "package.json": packageJson.version,
  "src-tauri/tauri.conf.json": tauriConfig.version,
  "src-tauri/Cargo.toml": extract(cargoSource, /^version\s*=\s*"([^"\n]+)"/m, "Tauri Cargo version"),
  "cli/src/program.ts": extract(cliSource, /\.version\("([^"\n]+)"\)/, "CLI version"),
  "plugins/timemanage/scripts/timemanage.mjs": extract(pluginBundleSource, /\.version\("([^"\n]+)"\)/, "bundled plugin CLI version"),
  "plugins/timemanage/.codex-plugin/plugin.json": pluginManifest.version,
  "scripts/bootstrap-timemanage-codex.mjs default ref": extract(bootstrapSource, /defaultRef = "v([^"\n]+)"/, "bootstrap default ref"),
  "scripts/bootstrap-timemanage-codex.mjs plugin version": extract(bootstrapSource, /defaultPluginVersion = "([^"\n]+)"/, "bootstrap plugin version"),
  "scripts/bootstrap-timemanage-codex.mjs minimum client": extract(bootstrapSource, /defaultMinimumClientRelease = "([^"\n]+)"/, "bootstrap minimum client"),
  "src/releaseContract.ts": extract(frontendSource, /releaseVersion:\s*"([^"\n]+)"/, "frontend release version"),
  "team-server/release_contract.go": extract(backendSource, /releaseVersion\s*=\s*"([^"\n]+)"/, "backend release version"),
};

const mismatches = Object.entries(versions).filter(([, version]) => version !== releaseVersion);
if (mismatches.length > 0) {
  const details = mismatches.map(([source, version]) => `  ${source}: ${version ?? "missing"}`).join("\n");
  throw new Error(`Release contract version alignment failed for ${releaseVersion}:\n${details}`);
}

const numericChecks = [
  ["src/releaseContract.ts api protocol", extract(frontendSource, /apiProtocolVersion:\s*(\d+)/, "frontend API protocol")],
  ["src/releaseContract.ts database schema", extract(frontendSource, /databaseSchemaVersion:\s*(\d+)/, "frontend database schema")],
  ["src/releaseContract.ts minimum client", extract(frontendSource, /minimumClientRelease:\s*"([^"\n]+)"/, "frontend minimum client")],
  ["team-server api protocol", extract(backendSource, /apiProtocolVersion\s+int64\s*=\s*(\d+)/, "backend API protocol")],
  ["team-server database schema", extract(backendSource, /databaseSchemaVersion\s+int64\s*=\s*(\d+)/, "backend database schema")],
  ["team-server minimum client", extract(backendSource, /minimumClientRelease\s*=\s*"([^"\n]+)"/, "backend minimum client")],
  ["bootstrap API protocol", extract(bootstrapSource, /defaultApiProtocolVersion = (\d+)/, "bootstrap API protocol")],
  ["bootstrap database schema", extract(bootstrapSource, /defaultDatabaseSchemaVersion = (\d+)/, "bootstrap database schema")],
  ["bootstrap minimum client", extract(bootstrapSource, /defaultMinimumClientRelease = "([^"\n]+)"/, "bootstrap minimum client")],
];
const expectedNumeric = [
  ["src/releaseContract.ts api protocol", String(apiProtocolVersion)],
  ["src/releaseContract.ts database schema", String(databaseSchemaVersion)],
  ["src/releaseContract.ts minimum client", minimumClientRelease],
  ["team-server api protocol", String(apiProtocolVersion)],
  ["team-server database schema", String(databaseSchemaVersion)],
  ["team-server minimum client", minimumClientRelease],
  ["bootstrap API protocol", String(apiProtocolVersion)],
  ["bootstrap database schema", String(databaseSchemaVersion)],
  ["bootstrap minimum client", minimumClientRelease],
];
const contractMismatches = numericChecks.filter(([, value], index) => value !== expectedNumeric[index][1]);
if (contractMismatches.length > 0) {
  throw new Error(contractMismatches.map(([label, value], index) => `${label}: ${value} (expected ${expectedNumeric[index][1]})`).join("\n"));
}

for (const [source, expected] of [
  ["src-tauri/gen/apple/project.yml", `MARKETING_VERSION: ${releaseVersion}`],
  ["src-tauri/gen/apple/timemanage-desktop.xcodeproj/project.pbxproj", `MARKETING_VERSION = ${releaseVersion}`],
  ["src-tauri/gen/apple/timemanage-desktop_iOS/Info.plist", `<string>${releaseVersion}</string>`],
  ["src-tauri/gen/apple/TimerLiveActivity/Info.plist", `<string>${releaseVersion}</string>`],
]) {
  const sourceText = {
    "src-tauri/gen/apple/project.yml": iosProjectSource,
    "src-tauri/gen/apple/timemanage-desktop.xcodeproj/project.pbxproj": iosXcodeSource,
    "src-tauri/gen/apple/timemanage-desktop_iOS/Info.plist": iosAppInfoSource,
    "src-tauri/gen/apple/TimerLiveActivity/Info.plist": iosExtensionInfoSource,
  }[source];
  if (!sourceText.includes(expected)) throw new Error(`${source} is not aligned to v${releaseVersion}.`);
}

if (pluginBundleSource.includes("/team/data")) {
  throw new Error("Bundled TimeManage plugin still contains the retired /team/data protocol.");
}

if (!migrationCatalog.includes(`SchemaVersion: ${databaseSchemaVersion}, ReleaseVersion: serverReleaseVersion`)) {
  throw new Error(`Migration catalog does not end at database schema ${databaseSchemaVersion}.`);
}
const migrationFilePrefix = String(databaseSchemaVersion).padStart(5, "0");
if (!migrationCatalog.includes(`FileName: "${migrationFilePrefix}_v${releaseVersion.replaceAll(".", "_")}_`)) {
  throw new Error(`Migration catalog is missing the release migration for v${releaseVersion}.`);
}

const versionCheck = spawnSync(process.execPath, [join(rootDir, "scripts", "verify-release-version.mjs"), releaseVersion], {
  cwd: rootDir,
  encoding: "utf8",
});
if (versionCheck.status !== 0) throw new Error(versionCheck.stderr || versionCheck.stdout || "Release version check failed.");

console.log(`Release contract alignment passed: v${releaseVersion} / API ${apiProtocolVersion} / schema ${databaseSchemaVersion}`);
