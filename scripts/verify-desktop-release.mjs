import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const expectedBackendUrl = "https://www.hudashuai.xyz/timemanage-team/api/";
const read = (path) => readFileSync(join(root, path), "utf8");
const readJSON = (path) => JSON.parse(read(path));

const desktopEnvironment = read(".env.desktop-production");
const backendUrl = desktopEnvironment
  .split(/\r?\n/)
  .find((line) => line.startsWith("VITE_TM_BACKEND_SERVER_URL="))
  ?.slice("VITE_TM_BACKEND_SERVER_URL=".length)
  .trim();
const packageJSON = readJSON("package.json");
const tauriConfig = readJSON("src-tauri/tauri.conf.json");
const failures = [];

if (backendUrl !== expectedBackendUrl) {
  failures.push(`desktop production backend must be ${expectedBackendUrl}`);
}
if (!backendUrl?.startsWith("https://")) {
  failures.push("desktop production backend must use HTTPS");
}
if (packageJSON.scripts?.["build:desktop"] !== "tsc -p tsconfig.app.json && vite build --mode desktop-production") {
  failures.push("build:desktop must use the desktop-production Vite mode");
}
if (tauriConfig.build?.beforeBuildCommand !== "npm run build:desktop") {
  failures.push("Tauri production builds must use npm run build:desktop");
}

if (failures.length > 0) {
  throw new Error(`Desktop release configuration failed:\n${failures.map((failure) => `  - ${failure}`).join("\n")}`);
}

console.log(`Desktop release configuration passed: ${backendUrl}`);
