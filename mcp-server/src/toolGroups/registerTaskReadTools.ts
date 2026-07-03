import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import { handle, taskStatusSchema } from "../toolShared.js";

export function registerTaskReadTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "list_tasks",
    {
      title: "List Tasks",
      description: "按项目、状态、执行人或关键词查询任务。",
      inputSchema: {
        projectId: z.string().optional(),
        status: taskStatusSchema.or(z.literal("all")).optional(),
        assigneeMemberId: z.string().optional(),
        query: z.string().optional(),
        includeArchived: z.boolean().optional(),
        includeSplit: z.boolean().optional(),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async (input) => handle(() => client.listTasks(input)),
  );

  server.registerTool(
    "get_task",
    {
      title: "Get Task",
      description: "读取单个任务详情、项目成员和关联工作会话。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.getTask(taskId)),
  );

  server.registerTool(
    "get_today_plan",
    {
      title: "Get Today Plan",
      description: "读取今天的准备执行队列及队列任务。",
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async () => handle(() => client.getTodayPlan()),
  );

  server.registerTool(
    "get_today_workbench",
    {
      title: "Get Today Workbench",
      description: "按成员分组读取今日准备执行任务，并标记当前正在执行的任务。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getTodayWorkbench(projectId)),
  );

  server.registerTool(
    "get_active_work",
    {
      title: "Get Active Work",
      description: "读取当前 active/paused 工作会话，跨用户判断谁正在执行什么。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getActiveWork(projectId)),
  );

  server.registerTool(
    "get_project_overview",
    {
      title: "Get Project Overview",
      description: "读取单项目概览，包括进度、活跃会话、风险分组和状态计数。",
      inputSchema: { projectId: z.string() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.getProjectOverview(projectId)),
  );

  server.registerTool(
    "list_pending_reviews",
    {
      title: "List Pending Reviews",
      description: "查询待验收任务，可按项目过滤。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.listPendingReviews(projectId)),
  );

  server.registerTool(
    "list_risk_tasks",
    {
      title: "List Risk Tasks",
      description: "查询项目风险任务，包括已分配未开始、停滞、阻塞、待验收和临近预计完成。",
      inputSchema: { projectId: z.string().optional() },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ projectId }) => handle(() => client.listRiskTasks(projectId)),
  );
}
