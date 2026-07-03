import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import { handle } from "../toolShared.js";

export function registerTaskQueueTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "batch_add_tasks_to_today",
    {
      title: "Batch Add Tasks To Today",
      description: "批量加入今日准备执行队列。",
      inputSchema: { taskIds: z.array(z.string()) },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskIds }) => handle(() => client.batchAddTasksToToday(taskIds)),
  );

  server.registerTool(
    "add_task_to_today",
    {
      title: "Add Task To Today",
      description: "把任务加入今天准备执行队列；任务为 pool 时会转为 committed。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.addTaskToToday(taskId)),
  );

  server.registerTool(
    "remove_task_from_today",
    {
      title: "Remove Task From Today",
      description: "从今天准备执行队列移除任务；任务仍为 committed 时会回到 pool。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.removeTaskFromToday(taskId)),
  );
}
