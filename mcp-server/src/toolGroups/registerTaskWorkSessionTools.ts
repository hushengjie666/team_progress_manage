import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TimeManageMcpClient } from "../core.js";
import { handle } from "../toolShared.js";

export function registerTaskWorkSessionTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "start_task",
    {
      title: "Start Task",
      description: "开始任务，创建 FocusSession、WorkSession 和 ExecutionSignal，并把任务转为 in_progress。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.startTask(taskId)),
  );

  server.registerTool(
    "pause_work_session",
    {
      title: "Pause Work Session",
      description: "暂停当前工作会话，可按 taskId 或 workSessionId 定位。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.pauseWorkSession(input)),
  );

  server.registerTool(
    "resume_work_session",
    {
      title: "Resume Work Session",
      description: "恢复暂停中的工作会话，可按 taskId 或 workSessionId 定位。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.resumeWorkSession(input)),
  );

  server.registerTool(
    "finish_work_session",
    {
      title: "Finish Work Session",
      description: "结束工作会话，完成一颗番茄并写入 work_ended 信号。",
      inputSchema: { taskId: z.string().optional(), workSessionId: z.string().optional() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async (input) => handle(() => client.finishWorkSession(input)),
  );
}
