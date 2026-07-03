import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimeManageMcpClient } from "../core.js";
import { registerTaskAssignmentTools } from "./registerTaskAssignmentTools.js";
import { registerTaskCrudTools } from "./registerTaskCrudTools.js";

export function registerTaskMutationTools(server: McpServer, client: TimeManageMcpClient) {
  registerTaskCrudTools(server, client);
  registerTaskAssignmentTools(server, client);
}
