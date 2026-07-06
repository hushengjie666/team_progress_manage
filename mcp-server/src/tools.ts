import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimeManageMcpClient } from "./core.js";
import { registerMemberTools, registerProjectTools } from "./toolRegistration/memberProjectTools.js";
import {
  registerAccountTools,
  registerInvitationTools,
  registerSystemTools,
  registerWorkspaceTools,
} from "./toolRegistration/systemWorkspaceTools.js";
import { registerTaskTools } from "./toolRegistration/taskTools.js";
import { registerReviewAndSettingsTools, registerTodayAndWorkTools } from "./toolRegistration/workflowTools.js";

export function registerTimeManageTools(server: McpServer, client: TimeManageMcpClient) {
  registerSystemTools(server, client);
  registerWorkspaceTools(server, client);
  registerAccountTools(server, client);
  registerInvitationTools(server, client);
  registerMemberTools(server, client);
  registerProjectTools(server, client);
  registerTaskTools(server, client);
  registerTodayAndWorkTools(server, client);
  registerReviewAndSettingsTools(server, client);
}
