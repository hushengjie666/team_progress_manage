import { existsSync, readFileSync } from "node:fs";
import { hostname } from "node:os";
import { resolve } from "node:path";

export interface TimeManageMcpConfig {
  serverUrl: string;
  email: string;
  password: string;
  deviceId: string;
}

const readJsonConfig = (path?: string): Partial<TimeManageMcpConfig> => {
  if (!path) return {};
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`MCP config file not found: ${resolved}`);
  }
  return JSON.parse(readFileSync(resolved, "utf8")) as Partial<TimeManageMcpConfig>;
};

const firstValue = (...values: Array<string | undefined>) =>
  values.find((value) => value !== undefined && value.trim() !== "")?.trim();

export function loadConfig(env: NodeJS.ProcessEnv = process.env): TimeManageMcpConfig {
  const fileConfig = readJsonConfig(env.TM_MCP_CONFIG);
  const serverUrl = firstValue(env.TM_MCP_SERVER_URL, fileConfig.serverUrl, "http://127.0.0.1:8787")!;
  const email = firstValue(env.TM_MCP_EMAIL, fileConfig.email);
  const password = firstValue(env.TM_MCP_PASSWORD, fileConfig.password);
  const deviceId = firstValue(env.TM_MCP_DEVICE_ID, fileConfig.deviceId, `timemanage_mcp_${hostname()}`)!;

  if (!email || !password) {
    throw new Error("TimeManage MCP requires TM_MCP_EMAIL and TM_MCP_PASSWORD, or TM_MCP_CONFIG with email/password.");
  }

  return { serverUrl, email, password, deviceId };
}
