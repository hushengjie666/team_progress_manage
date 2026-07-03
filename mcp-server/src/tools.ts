import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimeManageMcpClient } from "./core.js";
import { registerDailyAndSystemTools } from "./toolGroups/registerDailyAndSystemTools.js";
import { registerMemberTools } from "./toolGroups/registerMemberTools.js";
import { registerProjectTools } from "./toolGroups/registerProjectTools.js";
import { registerTaskTools } from "./toolGroups/registerTaskTools.js";

export function registerTimeManageTools(server: McpServer, client: TimeManageMcpClient) {
  registerProjectTools(server, client);
  registerMemberTools(server, client);
  registerTaskTools(server, client);
  registerDailyAndSystemTools(server, client);
}
