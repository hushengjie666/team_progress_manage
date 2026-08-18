import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const readJson = (path) => JSON.parse(readFileSync(join(rootDir, path), "utf8"));
const packageVersion = readJson("package.json").version;
const expectedVersion = process.argv[2] ?? packageVersion;

const cargoMetadata = spawnSync("cargo", [
  "metadata",
  "--no-deps",
  "--format-version",
  "1",
  "--locked",
  "--manifest-path",
  join(rootDir, "src-tauri", "Cargo.toml"),
], { cwd: rootDir, encoding: "utf8" });

if (cargoMetadata.status !== 0) {
  throw new Error(cargoMetadata.stderr || "Unable to read Tauri Cargo metadata.");
}

const cargoPackage = JSON.parse(cargoMetadata.stdout).packages
  .find((item) => item.name === "timemanage-desktop");
const cliSource = readFileSync(join(rootDir, "cli", "src", "program.ts"), "utf8");
const pluginBundleSource = readFileSync(join(rootDir, "plugins", "timemanage", "scripts", "timemanage.mjs"), "utf8");
const bootstrapSource = readFileSync(join(rootDir, "scripts", "bootstrap-timemanage-codex.mjs"), "utf8");
const backendContractSource = readFileSync(join(rootDir, "team-server", "release_contract.go"), "utf8");

const extract = (source, pattern, label) => {
  const value = source.match(pattern)?.[1];
  if (!value) throw new Error(`Unable to read ${label}.`);
  return value;
};

const versions = {
  "package.json": packageVersion,
  "src-tauri/tauri.conf.json": readJson("src-tauri/tauri.conf.json").version,
  "src-tauri/Cargo.toml": cargoPackage?.version,
  "cli/src/program.ts": extract(cliSource, /\.version\("([^"\n]+)"\)/, "CLI version"),
  "plugins/timemanage/scripts/timemanage.mjs": extract(pluginBundleSource, /\.version\("([^"\n]+)"\)/, "bundled plugin CLI version"),
  "plugins/timemanage/.codex-plugin/plugin.json": readJson("plugins/timemanage/.codex-plugin/plugin.json").version,
  "scripts/bootstrap-timemanage-codex.mjs default ref": extract(bootstrapSource, /defaultRef = "v([^"\n]+)"/, "bootstrap default ref"),
  "scripts/bootstrap-timemanage-codex.mjs plugin version": extract(bootstrapSource, /defaultPluginVersion = "([^"\n]+)"/, "bootstrap plugin version"),
  "team-server/release_contract.go": extract(backendContractSource, /releaseVersion\s+=\s+"([^"\n]+)"/, "backend release version"),
};

const mismatches = Object.entries(versions).filter(([, version]) => version !== expectedVersion);
if (mismatches.length > 0) {
  const details = mismatches.map(([source, version]) => `  ${source}: ${version ?? "missing"}`).join("\n");
  throw new Error(`Release version must be ${expectedVersion}:\n${details}`);
}

console.log(`Release version alignment passed: ${expectedVersion}`);
