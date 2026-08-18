import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

const handler = read("team-server/business_handlers.go");
const store = read("team-server/business_store.go");
const api = read("src/teamBusinessApi.ts");
const routes = read("team-server/server_routes.go");
const commands = read("src/teamDomainCommands.ts");
const storage = read("src/storage.ts");

if (handler.includes("nextKeys") || handler.includes("businessDeleteRow(ctx")) {
  failures.push("team data save still contains snapshot-absence deletion");
}
if (store.includes("row_version") || store.includes("expected_revision")) {
  failures.push("business storage still contains client revision concurrency");
}
if ((routes.includes('"/team/data"') && !routes.includes("handleLegacyTeamData")) || !routes.includes('"/app/bootstrap"')) {
  failures.push("server routes still expose a writable snapshot protocol or omit bootstrap");
}
if (!api.includes('"/app/bootstrap"') || !commands.includes("submitTeamDomainCommand")) {
  failures.push("frontend is not using bootstrap plus domain commands");
}
if (storage.includes("activeRuntime:") || storage.includes("projects: state.projects")) {
  failures.push("local storage still persists business data");
}

if (failures.length) {
  console.error(`Data safety audit failed:\n${failures.map((item) => `  - ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Data safety audit passed.");
