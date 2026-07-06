import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir, platform } from "node:os";

const defaultServerUrl = "https://www.hudashuai.xyz/timemanage-team/api/";

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

const endpoint = (serverUrl, path) => `${normalizeServerUrl(serverUrl)}${path}`;

const readConfig = (path) => {
  if (!existsSync(path)) {
    throw new Error(`TimeManage MCP config not found: ${path}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
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

const main = async () => {
  const configPath = valueFor("--config") || process.env.TM_MCP_CONFIG || defaultConfigPath();
  if (hasFlag("--dry-run")) {
    console.log(`TimeManage doctor dry run ok. Config path: ${configPath}`);
    return;
  }

  const config = readConfig(configPath);
  const serverUrl = valueFor("--server-url") || config.serverUrl || defaultServerUrl;
  const email = valueFor("--email") || config.email;
  const password = process.env.TIMEMANAGE_MCP_PASSWORD || config.password;
  const deviceId = valueFor("--device-id") || config.deviceId || "timemanage_mcp_doctor";

  if (!email) throw new Error("TimeManage email is required.");
  if (!password) throw new Error("TimeManage password is required.");

  await requestJson(endpoint(serverUrl, "/health"));
  const status = await requestJson(endpoint(serverUrl, "/auth/status"));
  const login = await requestJson(endpoint(serverUrl, "/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      password,
      device_id: deviceId,
    }),
  });

  console.log(JSON.stringify({
    ok: true,
    serverUrl: normalizeServerUrl(serverUrl),
    bootstrapped: Boolean(status.bootstrapped),
    account: login.account?.email || email,
    workspace: login.workspace?.name || "",
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
