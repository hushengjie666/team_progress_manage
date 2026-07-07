import { copyFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const run = (command, args) => {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
};

const copy = (from, to) => {
  mkdirSync(dirname(to), { recursive: true });
  copyFileSync(from, to);
};

run("npm", ["run", "cli:build"]);

const pluginRoot = join(repoRoot, "plugins", "timemanage");
copy(
  join(repoRoot, "skills", "timemanage", "SKILL.md"),
  join(pluginRoot, "skills", "timemanage", "SKILL.md"),
);
copy(
  join(repoRoot, "mcp-server", "dist", "cli.js"),
  join(pluginRoot, "scripts", "timemanage.mjs"),
);

const manifest = JSON.parse(readFileSync(join(pluginRoot, ".codex-plugin", "plugin.json"), "utf8"));
if (manifest.name !== "timemanage") {
  throw new Error("plugins/timemanage/.codex-plugin/plugin.json must use name timemanage");
}

console.log("TimeManage Codex plugin bundle refreshed.");
