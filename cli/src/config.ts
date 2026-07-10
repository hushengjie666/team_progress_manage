import { existsSync, readFileSync } from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { join, resolve } from "node:path";

export interface TimeManageCliConfig {
  serverUrl: string;
  email: string;
  password: string;
  deviceId: string;
}

export const defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage CLI", "config.json");
  }
  return join(homedir(), ".config", "timemanage-cli", "config.json");
};

const readJsonConfig = (path?: string): Partial<TimeManageCliConfig> => {
  if (!path) return {};
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`TimeManage config file not found: ${resolved}`);
  }
  return JSON.parse(readFileSync(resolved, "utf8")) as Partial<TimeManageCliConfig>;
};

const firstValue = (...values: Array<string | undefined>) =>
  values.find((value) => value !== undefined && value.trim() !== "")?.trim();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TimeManageCliConfig {
  const configPath = env.TM_CLI_CONFIG || (existsSync(defaultConfigPath()) ? defaultConfigPath() : undefined);
  const fileConfig = readJsonConfig(configPath);
  const serverUrl = firstValue(env.TM_CLI_SERVER_URL, fileConfig.serverUrl, "http://127.0.0.1:8787")!;
  const email = firstValue(env.TM_CLI_EMAIL, fileConfig.email);
  const password = firstValue(env.TM_CLI_PASSWORD, fileConfig.password);
  const deviceId = firstValue(env.TM_CLI_DEVICE_ID, fileConfig.deviceId, `timemanage_cli_${hostname()}`)!;

  if (!email || !password) {
    throw new Error("TimeManage CLI requires account and password via local config or environment.");
  }

  return { serverUrl, email, password, deviceId };
}
