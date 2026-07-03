import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireConfirmation, type TimeManageMcpClient } from "../core.js";
import { handle, prioritySchema, repeatRuleSchema, severitySchema, stageSchema, taskInputSchema } from "../toolShared.js";

export function registerTaskCrudTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "create_task",
    {
      title: "Create Task",
      description: "在指定项目创建任务，默认状态为任务池 pool。",
      inputSchema: {
        projectId: z.string(),
        ...taskInputSchema,
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.createTask(input)),
  );

  server.registerTool(
    "update_task",
    {
      title: "Update Task",
      description: "更新任务基本信息、分类、排期和子任务。",
      inputSchema: {
        taskId: z.string(),
        title: z.string().optional(),
        notes: z.string().optional(),
        tags: z.array(z.string()).optional(),
        priority: prioritySchema.optional(),
        severity: severitySchema.optional(),
        stage: stageSchema.optional(),
        estimateHours: z.number().optional(),
        estimatePomodoros: z.number().optional(),
        expectedStartAt: z.string().optional(),
        expectedFinishAt: z.string().optional(),
        dueAt: z.string().optional(),
        reminderAt: z.string().optional(),
        repeatRule: repeatRuleSchema.optional(),
        repeatIntervalDays: z.number().optional(),
        subtasks: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, ...input }) => handle(() => client.updateTask(taskId, input)),
  );

  server.registerTool(
    "batch_create_tasks",
    {
      title: "Batch Create Tasks",
      description: "在同一项目批量创建任务，适合从会议纪要或需求清单拆出任务。",
      inputSchema: {
        projectId: z.string(),
        tasks: z.array(z.object(taskInputSchema)),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ projectId, tasks }) => handle(() => client.batchCreateTasks(projectId, tasks)),
  );

  server.registerTool(
    "split_task",
    {
      title: "Split Task",
      description: "把一个主任务标记为已拆分，并创建多个子任务。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        childTitles: z.array(z.string()),
        confirmed: z.boolean().optional().describe("仅在用户确认拆分主任务后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, childTitles, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "split_task");
      return client.splitTask(taskId, childTitles);
    }),
  );

  server.registerTool(
    "delete_task",
    {
      title: "Delete Task",
      description: "删除任务并同步清理今日队列、工作会话和执行信号引用。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认删除后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "delete_task");
      return client.deleteTask(taskId);
    }),
  );
}
