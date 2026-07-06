import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { homedir, platform } from "node:os";

const scriptDir = dirname(fileURLToPath(import.meta.url));
const mcpEntry = join(scriptDir, "..", "mcp", "index.js");

const defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage MCP", "config.json");
  }
  return join(homedir(), ".config", "timemanage-mcp", "config.json");
};

if (!existsSync(mcpEntry)) {
  console.error(`TimeManage MCP entry not found: ${mcpEntry}`);
  process.exit(1);
}

const child = spawn(process.execPath, [mcpEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    TM_MCP_CONFIG: process.env.TM_MCP_CONFIG || defaultConfigPath(),
  },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
