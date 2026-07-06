import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(repoRoot, "plugins", "timemanage");

const requiredFiles = [
  { root: pluginRoot, path: ".codex-plugin/plugin.json" },
  { root: pluginRoot, path: ".mcp.json" },
  { root: pluginRoot, path: "skills/timemanage/SKILL.md" },
  { root: pluginRoot, path: "mcp/index.js" },
  { root: pluginRoot, path: "scripts/start-mcp.mjs" },
  { root: pluginRoot, path: "scripts/doctor.mjs" },
  { root: pluginRoot, path: "scripts/setup.mjs" },
  { root: repoRoot, path: ".agents/plugins/marketplace.json" },
  { root: repoRoot, path: "scripts/bootstrap-timemanage-codex.mjs" },
];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

const fail = (message) => {
  console.error(message);
  process.exit(1);
};

for (const file of requiredFiles) {
  const fullPath = join(file.root, file.path);
  if (!existsSync(fullPath)) fail(`Missing required file: ${file.path}`);
}

const manifest = readJson(join(pluginRoot, ".codex-plugin", "plugin.json"));
if (manifest.name !== "timemanage") fail("Plugin manifest name must be timemanage.");
if (manifest.skills !== "./skills/") fail("Plugin manifest must point skills to ./skills/.");
if (manifest.mcpServers !== "./.mcp.json") fail("Plugin manifest must point mcpServers to ./.mcp.json.");
if (!Array.isArray(manifest.interface?.defaultPrompt)) fail("Plugin defaultPrompt must be an array.");

const mcp = readJson(join(pluginRoot, ".mcp.json"));
const server = mcp.mcpServers?.timemanage;
if (!server) fail("MCP config must contain mcpServers.timemanage.");
if (server.command !== "node") fail("TimeManage MCP command must be node.");
if (!server.args?.includes("./scripts/start-mcp.mjs")) fail("TimeManage MCP args must launch ./scripts/start-mcp.mjs.");

const marketplace = readJson(join(repoRoot, ".agents", "plugins", "marketplace.json"));
if (marketplace.name !== "timemanage-team") fail("Marketplace name must be timemanage-team.");
if (!marketplace.plugins?.some((plugin) => plugin.name === "timemanage")) fail("Marketplace must include timemanage.");

const skill = readFileSync(join(pluginRoot, "skills", "timemanage", "SKILL.md"), "utf8");
if (!skill.includes("TimeManage MCP Skill")) fail("Plugin skill is not the TimeManage skill.");

for (const script of [
  join(pluginRoot, "scripts", "start-mcp.mjs"),
  join(pluginRoot, "scripts", "doctor.mjs"),
  join(pluginRoot, "scripts", "setup.mjs"),
  join(repoRoot, "scripts", "bootstrap-timemanage-codex.mjs"),
  join(repoRoot, "scripts", "build-timemanage-codex-plugin.mjs"),
]) {
  const result = spawnSync(process.execPath, ["--check", script], { encoding: "utf8" });
  if (result.status !== 0) fail(result.stderr || `${script} failed syntax check.`);
}

const doctor = spawnSync(process.execPath, [join(pluginRoot, "scripts", "doctor.mjs"), "--dry-run"], {
  encoding: "utf8",
});
if (doctor.status !== 0) fail(doctor.stderr || "Doctor dry run failed.");

console.log("TimeManage Codex plugin validation passed.");
