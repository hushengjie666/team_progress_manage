import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { homedir, hostname, platform } from "node:os";
import { spawnSync } from "node:child_process";
import readline from "node:readline/promises";

const defaultRepo = "hushengjie666/team_progress_manage";
const defaultRef = "v0.2.4";
const defaultMarketplace = "timemanage-team";
const defaultServerUrl = "https://www.hudashuai.xyz/timemanage-team/api/";
const defaultPluginVersion = "0.2.4";

const args = process.argv.slice(2);

const valueFor = (name) => {
  const index = args.indexOf(name);
  if (index === -1) return undefined;
  return args[index + 1];
};

const hasFlag = (name) => args.includes(name);

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    encoding: "utf8",
    stdio: options.capture ? "pipe" : "inherit",
    env: process.env,
  });
  if (result.status !== 0 && !options.allowFailure) {
    const detail = result.stderr || result.stdout || `${command} ${commandArgs.join(" ")} failed`;
    throw new Error(detail.trim());
  }
  return result;
};

const defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage CLI", "config.json");
  }
  return join(homedir(), ".config", "timemanage-cli", "config.json");
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

const pluginCliPath = (marketplace, version) =>
  join(homedir(), ".codex", "plugins", "cache", marketplace, "timemanage", version, "scripts", "timemanage.mjs");

const installCliLauncher = (marketplace, version, launcherPath = defaultLauncherPath()) => {
  const cliPath = pluginCliPath(marketplace, version);
  mkdirSync(dirname(launcherPath), { recursive: true });
  if (platform() === "win32") {
    writeFileSync(launcherPath, `@echo off\r\nnode "${cliPath}" %*\r\n`);
    return launcherPath;
  }
  writeFileSync(launcherPath, `#!/usr/bin/env sh\nexec node ${shellQuote(cliPath)} "$@"\n`, { mode: 0o755 });
  try { chmodSync(launcherPath, 0o755); } catch {}
  return launcherPath;
};

const endpoint = (serverUrl, path) => `${normalizeServerUrl(serverUrl)}${path}`;

const ask = async (question, fallback = "") => {
  if (!process.stdin.isTTY) return fallback;
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await rl.question(fallback ? `${question} (${fallback}): ` : `${question}: `);
  rl.close();
  return answer.trim() || fallback;
};

const askHidden = async (question) => {
  if (process.env.TM_CLI_PASSWORD) return process.env.TM_CLI_PASSWORD;
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error("Password requires an interactive terminal, or set TM_CLI_PASSWORD for this run.");
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

const requestJson = async (url, init) => {
  const response = await fetch(url, init);
  if (response.ok) return response.json();
  let message = `${response.status} ${response.statusText}`;
  try {
    const payload = await response.json();
    if (payload?.error) message = payload.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};

const verifyConnection = async ({ serverUrl, email, password, deviceId }) => {
  await requestJson(endpoint(serverUrl, "/health"));
  await requestJson(endpoint(serverUrl, "/auth/status"));
  await requestJson(endpoint(serverUrl, "/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      device_id: deviceId,
    }),
  });
};

const pluginInstalled = (marketplace) => {
  const result = run("codex", ["plugin", "list"], { capture: true, allowFailure: true });
  if (result.status !== 0 || !result.stdout) return false;
  return result.stdout.includes(`timemanage@${marketplace}`) && result.stdout.includes("installed, enabled");
};

const main = async () => {
  if (hasFlag("--help")) {
    console.log("Usage: node bootstrap-timemanage-codex.mjs --email <account> [--server-url <url>] [--ref <git-ref>]");
    return;
  }

  run("codex", ["--version"], { capture: true });

  const repo = valueFor("--repo") || defaultRepo;
  const ref = valueFor("--ref") || defaultRef;
  const marketplace = valueFor("--marketplace") || defaultMarketplace;
  const configPath = valueFor("--config") || defaultConfigPath();
  const serverUrl = normalizeServerUrl(valueFor("--server-url") || await ask("TimeManage server URL", defaultServerUrl));
  const email = valueFor("--email") || await ask("TimeManage account email");
  if (!email) throw new Error("TimeManage account email is required.");
  const password = await askHidden("TimeManage password");
  if (!password) throw new Error("TimeManage password is required.");
  const deviceId = valueFor("--device-id") || `timemanage_cli_${hostname()}`;

  const config = { serverUrl, email: email.trim(), password, deviceId };
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
  if (platform() !== "win32") {
    try { chmodSync(configPath, 0o600); } catch {}
  }

  const addMarketplace = run("codex", ["plugin", "marketplace", "add", repo, "--ref", ref], {
    capture: true,
    allowFailure: true,
  });
  if (addMarketplace.status !== 0) {
    run("codex", ["plugin", "marketplace", "upgrade", marketplace], { allowFailure: true });
  }

  if (!pluginInstalled(marketplace)) {
    const install = run("codex", ["plugin", "add", `timemanage@${marketplace}`], {
      capture: true,
      allowFailure: true,
    });
    if (install.status !== 0 && !pluginInstalled(marketplace)) {
      throw new Error((install.stderr || install.stdout || "TimeManage plugin install failed").trim());
    }
  }

  await verifyConnection({ serverUrl, email: email.trim(), password, deviceId });

  const launcherPath = hasFlag("--no-bin") ? undefined : installCliLauncher(marketplace, defaultPluginVersion, valueFor("--bin"));

  console.log("TimeManage CLI initialized.");
  console.log(`Config: ${configPath}`);
  if (launcherPath) console.log(`CLI: ${launcherPath}`);
  console.log("Run: timemanage doctor");
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
