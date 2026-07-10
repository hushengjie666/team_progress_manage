import { spawn, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const tauriBin = join(rootDir, "node_modules", ".bin", process.platform === "win32" ? "tauri.cmd" : "tauri");
const devConfigPath = join("src-tauri", "tauri.dev.conf.json");
const devProcessName = "timemanage-desktop-dev";
const focusAttemptsPerProcess = 8;

const child = spawn(tauriBin, ["dev", "--config", devConfigPath, "--", "--bin", devProcessName], {
  cwd: rootDir,
  env: process.env,
  stdio: "inherit",
});

let lastFocusedPid = "";
let pendingFocusAttempts = 0;

const timemanagePids = () => {
  if (process.platform !== "darwin") return [];
  const result = spawnSync("pgrep", ["-x", devProcessName], { encoding: "utf8" });
  if (result.status !== 0 || !result.stdout.trim()) return [];
  return result.stdout.trim().split(/\s+/).filter(Boolean);
};

const focusTimeManage = (pid) => {
  if (process.platform !== "darwin" || !pid) return;
  const result = spawnSync("osascript", [
    "-e",
    `tell application "System Events" to set frontmost of first process whose unix id is ${pid} to true`,
  ], { encoding: "utf8" });
  if (result.status !== 0) {
    return;
  }
};

const scheduleFocusForPid = (pid) => {
  if (!pid || pid === lastFocusedPid) return;
  lastFocusedPid = pid;
  pendingFocusAttempts = focusAttemptsPerProcess;
};

const focusPoll = process.platform === "darwin"
  ? setInterval(() => {
      const pids = timemanagePids();
      scheduleFocusForPid(pids[pids.length - 1]);
      if (pendingFocusAttempts > 0) {
        pendingFocusAttempts -= 1;
        focusTimeManage(lastFocusedPid);
      }
    }, 500)
  : undefined;

const stop = (signal) => {
  if (!child.killed) child.kill(signal);
};

process.on("SIGINT", () => stop("SIGINT"));
process.on("SIGTERM", () => stop("SIGTERM"));

child.on("exit", (code, signal) => {
  if (focusPoll) clearInterval(focusPoll);
  pendingFocusAttempts = 0;

  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
