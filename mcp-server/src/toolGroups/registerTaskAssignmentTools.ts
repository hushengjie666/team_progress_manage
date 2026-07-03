import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireConfirmation, type TimeManageMcpClient } from "../core.js";
import { handle, taskStatusSchema } from "../toolShared.js";

export function registerTaskAssignmentTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "batch_assign_tasks",
    {
      title: "Batch Assign Tasks",
      description: "批量分配任务主执行人和协作者。",
      inputSchema: {
        taskIds: z.array(z.string()),
        projectId: z.string().optional(),
        primaryExecutorMemberId: z.string().optional(),
        collaboratorMemberIds: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskIds, ...assignment }) => handle(() => client.batchAssignTasks(taskIds, assignment)),
  );

  server.registerTool(
    "assign_task",
    {
      title: "Assign Task",
      description: "分配任务主执行人、协作者，必要时迁移项目。",
      inputSchema: {
        taskId: z.string(),
        projectId: z.string().optional(),
        primaryExecutorMemberId: z.string().optional(),
        collaboratorMemberIds: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, ...assignment }) => handle(() => client.assignTask(taskId, assignment)),
  );

  server.registerTool(
    "set_task_status",
    {
      title: "Set Task Status",
      description: "直接修改任务状态。归档、完成、已拆分等高风险状态必须确认。",
      inputSchema: {
        taskId: z.string(),
        status: taskStatusSchema,
        confirmed: z.boolean().optional().describe("状态为 completed/split/archived 时，必须在用户确认后传 true。"),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, status, confirmed }) => handle(async () => {
      if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, `set_task_status:${status}`);
      return client.setTaskStatus(taskId, status);
    }),
  );

  server.registerTool(
    "update_task_progress",
    {
      title: "Update Task Progress",
      description: "更新任务进度百分比和进展说明。",
      inputSchema: {
        taskId: z.string(),
        progressPercent: z.number().min(0).max(100),
        progressNote: z.string().optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, progressPercent, progressNote }) => handle(() => client.updateTaskProgress(taskId, progressPercent, progressNote)),
  );
}
