import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimeManageMcpClient } from "../core.js";
import { registerTaskMutationTools } from "./registerTaskMutationTools.js";
import { registerTaskQueueTools } from "./registerTaskQueueTools.js";
import { registerTaskReadTools } from "./registerTaskReadTools.js";
import { registerTaskReviewTools } from "./registerTaskReviewTools.js";
import { registerTaskWorkSessionTools } from "./registerTaskWorkSessionTools.js";

export function registerTaskTools(server: McpServer, client: TimeManageMcpClient) {
  registerTaskReadTools(server, client);
  registerTaskMutationTools(server, client);
  registerTaskQueueTools(server, client);
  registerTaskWorkSessionTools(server, client);
  registerTaskReviewTools(server, client);
}
