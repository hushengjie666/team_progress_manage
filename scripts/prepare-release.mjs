import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const contractPath = join(rootDir, "release-contract.json");
const currentContract = JSON.parse(readFileSync(contractPath, "utf8"));
const args = process.argv.slice(2);
const releaseVersion = args.find((value) => !value.startsWith("--")) ?? currentContract.release_version;
const flag = (name, fallback) => {
  const prefix = `--${name}=`;
  const value = args.find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

if (!/^\d+\.\d+\.\d+$/.test(releaseVersion)) throw new Error(`Invalid release version: ${releaseVersion}`);
const apiProtocolVersion = Number(flag("api-protocol", currentContract.api_protocol_version));
const databaseSchemaVersion = Number(flag("schema-version", currentContract.database_schema_version));
const minimumClientRelease = flag("minimum-client-release", releaseVersion);
if (!Number.isInteger(apiProtocolVersion) || apiProtocolVersion < 1) throw new Error("--api-protocol must be a positive integer.");
if (!Number.isInteger(databaseSchemaVersion) || databaseSchemaVersion < 1) throw new Error("--schema-version must be a positive integer.");
if (!/^\d+\.\d+\.\d+$/.test(minimumClientRelease)) throw new Error("--minimum-client-release must be a stable semantic version.");

const writeJson = (relativePath, update) => {
  const path = join(rootDir, relativePath);
  const value = JSON.parse(readFileSync(path, "utf8"));
  writeFileSync(path, `${JSON.stringify(update(value), null, 2)}\n`);
};
const replace = (relativePath, pattern, replacement, label) => {
  const path = join(rootDir, relativePath);
  const source = readFileSync(path, "utf8");
  if (!pattern.test(source)) throw new Error(`Unable to update ${label} in ${relativePath}.`);
  writeFileSync(path, source.replace(pattern, replacement));
};

writeJson("release-contract.json", () => ({
  release_version: releaseVersion,
  api_protocol_version: apiProtocolVersion,
  database_schema_version: databaseSchemaVersion,
  minimum_client_release: minimumClientRelease,
}));
writeJson("package.json", (value) => ({ ...value, version: releaseVersion }));
writeJson("src-tauri/tauri.conf.json", (value) => ({ ...value, version: releaseVersion }));
writeJson("plugins/timemanage/.codex-plugin/plugin.json", (value) => ({ ...value, version: releaseVersion }));
replace("src-tauri/Cargo.toml", /^version\s*=\s*"[^"\n]+"/m, `version = "${releaseVersion}"`, "Cargo version");
replace("cli/src/program.ts", /\.version\("[^"\n]+"\)/, `.version("${releaseVersion}")`, "CLI version");
replace("scripts/bootstrap-timemanage-codex.mjs", /defaultRef = "v[^"\n]+"/, `defaultRef = "v${releaseVersion}"`, "bootstrap default ref");
replace("scripts/bootstrap-timemanage-codex.mjs", /defaultPluginVersion = "[^"\n]+"/, `defaultPluginVersion = "${releaseVersion}"`, "bootstrap plugin version");
replace("scripts/bootstrap-timemanage-codex.mjs", /defaultApiProtocolVersion = \d+/, `defaultApiProtocolVersion = ${apiProtocolVersion}`, "bootstrap API protocol");
replace("scripts/bootstrap-timemanage-codex.mjs", /defaultDatabaseSchemaVersion = \d+/, `defaultDatabaseSchemaVersion = ${databaseSchemaVersion}`, "bootstrap database schema");
replace("scripts/bootstrap-timemanage-codex.mjs", /defaultMinimumClientRelease = "[^"\n]+"/, `defaultMinimumClientRelease = "${minimumClientRelease}"`, "bootstrap minimum client");
replace("src/releaseContract.ts", /releaseVersion:\s*"[^"\n]+"/, `releaseVersion: "${releaseVersion}"`, "frontend release version");
replace("src/releaseContract.ts", /apiProtocolVersion:\s*\d+/, `apiProtocolVersion: ${apiProtocolVersion}`, "frontend API protocol");
replace("src/releaseContract.ts", /databaseSchemaVersion:\s*\d+/, `databaseSchemaVersion: ${databaseSchemaVersion}`, "frontend database schema");
replace("src/releaseContract.ts", /minimumClientRelease:\s*"[^"\n]+"/, `minimumClientRelease: "${minimumClientRelease}"`, "frontend minimum client");
replace("team-server/release_contract.go", /releaseVersion\s*=\s*"[^"\n]+"/, `releaseVersion          = "${releaseVersion}"`, "backend release version");
replace("team-server/release_contract.go", /apiProtocolVersion\s+int64\s*=\s*\d+/, `apiProtocolVersion      int64 = ${apiProtocolVersion}`, "backend API protocol");
replace("team-server/release_contract.go", /databaseSchemaVersion\s+int64\s*=\s*\d+/, `databaseSchemaVersion   int64 = ${databaseSchemaVersion}`, "backend database schema");
replace("team-server/release_contract.go", /minimumClientRelease\s*=\s*"[^"\n]+"/, `minimumClientRelease    = "${minimumClientRelease}"`, "backend minimum client");
replace("src-tauri/gen/apple/project.yml", /MARKETING_VERSION:\s*[^\s\n]+/g, `MARKETING_VERSION: ${releaseVersion}`, "iOS marketing version");
replace("src-tauri/gen/apple/timemanage-desktop.xcodeproj/project.pbxproj", /MARKETING_VERSION\s*=\s*[^;\n]+/g, `MARKETING_VERSION = ${releaseVersion}`, "Xcode marketing version");
replace("src-tauri/gen/apple/timemanage-desktop_iOS/Info.plist", /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleShortVersionString</key>\n\t<string>${releaseVersion}</string>`, "iOS app Info.plist version");
replace("src-tauri/gen/apple/TimerLiveActivity/Info.plist", /<key>CFBundleShortVersionString<\/key>\s*<string>[^<]+<\/string>/, `<key>CFBundleShortVersionString</key>\n\t<string>${releaseVersion}</string>`, "iOS extension Info.plist version");

const pluginBuild = spawnSync("npm", ["run", "plugin:build"], {
  cwd: rootDir,
  stdio: "inherit",
});
if (pluginBuild.status !== 0) process.exit(pluginBuild.status ?? 1);

const check = spawnSync(process.execPath, [join(rootDir, "scripts", "verify-release-contract.mjs")], {
  cwd: rootDir,
  encoding: "utf8",
});
if (check.status !== 0) throw new Error(check.stderr || check.stdout || "Prepared release does not satisfy the contract.");
console.log(`Release ${releaseVersion} prepared. Review the migration catalog and run the full release checks before tagging.`);
