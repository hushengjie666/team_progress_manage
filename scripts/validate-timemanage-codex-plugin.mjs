import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pluginRoot = join(repoRoot, "plugins", "timemanage");

const requiredFiles = [
  { root: pluginRoot, path: ".codex-plugin/plugin.json" },
  { root: pluginRoot, path: "skills/timemanage/SKILL.md" },
  { root: pluginRoot, path: "scripts/timemanage.mjs" },
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
if (manifest.version !== "0.2.0") fail("Plugin manifest version must be 0.2.0.");
if (manifest.skills !== "./skills/") fail("Plugin manifest must point skills to ./skills/.");
const retiredServerField = `${String.fromCharCode(109, 99, 112)}Servers`;
if (retiredServerField in manifest) fail("CLI plugin manifest must not register server integrations.");

const marketplace = readJson(join(repoRoot, ".agents", "plugins", "marketplace.json"));
if (marketplace.name !== "timemanage-team") fail("Marketplace name must be timemanage-team.");
if (!marketplace.plugins?.some((plugin) => plugin.name === "timemanage")) fail("Marketplace must include timemanage.");

const skill = readFileSync(join(pluginRoot, "skills", "timemanage", "SKILL.md"), "utf8");
if (!skill.includes("TimeManage CLI Skill")) fail("Plugin skill is not the TimeManage CLI skill.");

for (const script of [
  join(pluginRoot, "scripts", "timemanage.mjs"),
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

const help = spawnSync(process.execPath, [join(pluginRoot, "scripts", "timemanage.mjs"), "--help"], {
  encoding: "utf8",
});
if (help.status !== 0 || !help.stdout.includes("workspace") || !help.stdout.includes("project")) {
  fail(help.stderr || "CLI help smoke test failed.");
}

console.log("TimeManage Codex plugin validation passed.");
