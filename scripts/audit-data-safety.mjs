import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const read = (path) => readFileSync(resolve(root, path), "utf8");
const failures = [];

const handler = read("team-server/business_handlers.go");
const store = read("team-server/business_store.go");
const api = read("src/teamBusinessApi.ts");

if (handler.includes("nextKeys") || handler.includes("businessDeleteRow(ctx")) {
  failures.push("team data save still contains snapshot-absence deletion");
}
if (!store.includes("DELETE FROM %s WHERE workspace_id = ? AND id = ? AND row_version = ?")) {
  failures.push("business deletion is not guarded by row revision");
}
if (!api.includes("protocol_version: 2") || api.includes("JSON.stringify({ rows:")) {
  failures.push("frontend team writes are not using protocol 2 operations");
}

if (failures.length) {
  console.error(`Data safety audit failed:\n${failures.map((item) => `  - ${item}`).join("\n")}`);
  process.exit(1);
}

console.log("Data safety audit passed.");
