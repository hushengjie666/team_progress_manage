import { chmodSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, hostname, platform } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import readline from "node:readline/promises";

const defaultServerUrl = "https://www.hudashuai.xyz/timemanage-team/api/";
const scriptDir = dirname(fileURLToPath(import.meta.url));

const args = process.argv.slice(2);

const valueFor = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const hasFlag = (name) => args.includes(name);

const defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage MCP", "config.json");
  }
  return join(homedir(), ".config", "timemanage-mcp", "config.json");
};

const normalizeServerUrl = (serverUrl) => serverUrl.trim().replace(/\/+$/, "");

const defaultLauncherPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage CLI", "timemanage.cmd");
  }
  return join(homedir(), ".local", "bin", "timemanage");
};

const shellQuote = (value) => `'${value.replaceAll("'", "'\\''")}'`;

const installCliLauncher = (launcherPath = defaultLauncherPath()) => {
  const cliPath = join(scriptDir, "timemanage.mjs");
  mkdirSync(dirname(launcherPath), { recursive: true });
  if (platform() === "win32") {
    writeFileSync(launcherPath, `@echo off\r\nnode \"${cliPath}\" %*\r\n`);
    return launcherPath;
  }
  writeFileSync(launcherPath, `#!/usr/bin/env sh\nexec node ${shellQuote(cliPath)} \"$@\"\n`, { mode: 0o755 });
  try { chmodSync(launcherPath, 0o755); } catch {}
  return launcherPath;
};

const ask = async (question, fallback = "") => {
  if (!process.stdin.isTTY) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(fallback ? `${question} (${fallback}): ` : `${question}: `);
  rl.close();
  return answer.trim() || fallback;
};

const askHidden = async (question) => {
  if (process.env.TIMEMANAGE_CLI_PASSWORD) return process.env.TIMEMANAGE_CLI_PASSWORD;
  if (process.env.TIMEMANAGE_MCP_PASSWORD) return process.env.TIMEMANAGE_MCP_PASSWORD;
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Password requires an interactive terminal, or set TIMEMANAGE_CLI_PASSWORD for this run.");
  }
  return new Promise((resolve, reject) => {
    let value = "";
    const stdin = process.stdin;
    const cleanup = () => {
      stdin.setRawMode(false);
      stdin.pause();
      stdin.removeListener("data", onData);
      process.stdout.write("\n");
    };
    const onData = (chunk) => {
      const text = chunk.toString("utf8");
      if (text === "\u0003") {
        cleanup();
        reject(new Error("Canceled."));
        return;
      }
      if (text === "\r" || text === "\n") {
        cleanup();
        resolve(value);
        return;
      }
      if (text === "\u007f") {
        value = value.slice(0, -1);
        return;
      }
      value += text;
    };
    process.stdout.write(`${question}: `);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
  });
};

const main = async () => {
  const configPath = valueFor("--config") || defaultConfigPath();
  const serverUrl = normalizeServerUrl(valueFor("--server-url") || await ask("TimeManage server URL", defaultServerUrl));
  const email = valueFor("--email") || await ask("TimeManage account email");
  if (!email) throw new Error("TimeManage account email is required.");
  const password = await askHidden("TimeManage password");
  if (!password) throw new Error("TimeManage password is required.");

  const config = {
    serverUrl,
    email: email.trim(),
    password,
    deviceId: valueFor("--device-id") || `timemanage_cli_${hostname()}`,
  };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  if (platform() !== "win32") {
    try { chmodSync(configPath, 0o600); } catch {}
  }

  const doctorPath = join(scriptDir, "doctor.mjs");
  if (existsSync(doctorPath)) {
    const result = spawnSync(process.execPath, [doctorPath, "--config", configPath], {
      stdio: "inherit",
      env: { ...process.env, TIMEMANAGE_CLI_PASSWORD: password, TIMEMANAGE_MCP_PASSWORD: password },
    });
    if (result.status !== 0) process.exit(result.status ?? 1);
  }

  const launcherPath = hasFlag("--no-bin") ? undefined : installCliLauncher(valueFor("--bin"));

  console.log(`TimeManage Codex config written: ${configPath}`);
  if (launcherPath) console.log(`TimeManage CLI installed: ${launcherPath}`);
  console.log("Run: timemanage doctor");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
