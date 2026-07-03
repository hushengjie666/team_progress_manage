import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import { handle, moodSchema, textResult } from "../toolShared.js";

export function registerDailyAndSystemTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "get_daily_summary",
    {
      title: "Get Daily Summary",
      description: "读取某日的计划、今日队列任务、工作会话和洞察。",
      inputSchema: { date: z.string().optional().describe("YYYY-MM-DD；默认今天。") },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ date }) => handle(() => client.getDailySummary(date)),
  );

  server.registerTool(
    "update_daily_review",
    {
      title: "Update Daily Review",
      description: "更新某日总结/日终回顾字段。",
      inputSchema: {
        date: z.string().describe("YYYY-MM-DD"),
        mood: moodSchema.optional(),
        wins: z.string().optional(),
        blockers: z.string().optional(),
        interruptionPattern: z.string().optional(),
        tomorrowFocus: z.string().optional(),
        reflection: z.string().optional(),
        reviewed: z.boolean().optional().describe("true 表示标记已回顾，false 表示取消已回顾。"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ date, ...patch }) => handle(() => client.updateDailyReview(date, patch)),
  );

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
