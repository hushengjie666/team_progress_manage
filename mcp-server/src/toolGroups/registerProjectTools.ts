import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireConfirmation, type TimeManageMcpClient } from "../core.js";
import { handle } from "../toolShared.js";

export function registerProjectTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "list_projects",
    {
      title: "List Projects",
      description: "列出 TimeManage 项目及项目级进度、任务、成员概要。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.listProjects()),
  );

  server.registerTool(
    "search",
    {
      title: "Search TimeManage",
      description: "跨项目、成员、任务做关键词搜索，用于把自然语言名称解析为 id。",
      inputSchema: {
        query: z.string(),
        limit: z.number().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, limit }) => handle(() => client.search(query, limit)),
  );

  server.registerTool(
    "create_project",
    {
      title: "Create Project",
      description: "创建项目，并把当前 MCP 登录账号作为项目负责人/执行者绑定。",
      inputSchema: {
        name: z.string(),
        description: z.string().optional(),
        defaultExpectedStartHours: z.number().optional(),
        taskStageMode: z.enum(["regular", "software"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.createProject(input)),
  );

  server.registerTool(
    "update_project",
    {
      title: "Update Project",
      description: "更新项目名称、说明和默认预计开始小时。",
      inputSchema: {
        projectId: z.string(),
        name: z.string().optional(),
        description: z.string().optional(),
        defaultExpectedStartHours: z.number().optional(),
        taskStageMode: z.enum(["regular", "software"]).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId, ...input }) => handle(() => client.updateProject(projectId, input)),
  );

  server.registerTool(
    "archive_project",
    {
      title: "Archive Project",
      description: "归档项目。高风险，必须确认。",
      inputSchema: {
        projectId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认归档项目后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ projectId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "archive_project");
      return client.archiveProject(projectId);
    }),
  );

  server.registerTool(
    "restore_project",
    {
      title: "Restore Project",
      description: "恢复已归档项目。",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.restoreProject(projectId)),
  );
}
