import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const read = (path) => readFileSync(join(root, path), "utf8");
const tauri = JSON.parse(read("src-tauri/tauri.conf.json"));
const iosConfig = JSON.parse(read("src-tauri/tauri.ios.conf.json"));
const project = read("src-tauri/gen/apple/project.yml");
const exportOptions = read("src-tauri/gen/apple/ExportOptions.plist");
const iosEnvironment = read(".env.ios-production");

const expected = {
  version: "0.2.3",
  build: "2026071201",
  bundleId: "xyz.hudashuai.timemanage",
  extensionBundleId: "xyz.hudashuai.timemanage.TimerLiveActivity",
  teamId: "2P3ULGHFM8",
  backendUrl: "https://www.hudashuai.xyz/timemanage-team/api/",
};

const requireText = (source, value, label) => {
  if (!source.includes(value)) throw new Error(`${label} must contain ${value}.`);
};

if (tauri.version !== expected.version) throw new Error(`Tauri version must be ${expected.version}.`);
if (tauri.identifier !== expected.bundleId) throw new Error(`Tauri identifier must be ${expected.bundleId}.`);
if (iosConfig.build?.beforeBuildCommand !== "npm run build:ios") {
  throw new Error("The iOS build must use npm run build:ios.");
}

for (const [value, label] of [
  [`MARKETING_VERSION: ${expected.version}`, "marketing version"],
  [`CURRENT_PROJECT_VERSION: ${expected.build}`, "build number"],
  [`PRODUCT_BUNDLE_IDENTIFIER: ${expected.bundleId}`, "app bundle identifier"],
  [`PRODUCT_BUNDLE_IDENTIFIER: ${expected.extensionBundleId}`, "extension bundle identifier"],
  [`DEVELOPMENT_TEAM: ${expected.teamId}`, "development team"],
  ["TARGETED_DEVICE_FAMILY: 1", "iPhone-only device family"],
]) requireText(project, value, label);

if (project.includes("UISupportedInterfaceOrientations~ipad")) {
  throw new Error("The iPhone-only release must not declare iPad orientations.");
}
requireText(exportOptions, "app-store-connect", "export method");
requireText(exportOptions, expected.teamId, "export team");
requireText(iosEnvironment, expected.backendUrl, "iOS production backend");

console.log(`iOS release configuration passed: ${expected.bundleId} ${expected.version} (${expected.build})`);
