import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TimeManageMcpClient } from "../core.js";
import { handle, textResult } from "../toolShared.js";

export function registerDailyAndSystemTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "get_sync_diagnostics",
    {
      title: "Get Sync Diagnostics",
      description: "读取 MCP 视角下的后台诊断，包括本地 revision、远端 revision、实体数量和 tombstone 数。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.getSyncDiagnostics()),
  );

  server.registerTool(
    "health",
    {
      title: "Health",
      description: "检查 MCP server 本身是否可用。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => textResult("TimeManage MCP server is running."),
  );
}
