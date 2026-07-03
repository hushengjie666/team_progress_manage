import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { requireConfirmation, type TimeManageMcpClient } from "../core.js";
import { handle } from "../toolShared.js";

export function registerTaskReviewTools(server: McpServer, client: TimeManageMcpClient) {
  server.registerTool(
    "submit_task_review",
    {
      title: "Submit Task Review",
      description: "提交任务验收：committed/in_progress -> pending_review。",
      inputSchema: { taskId: z.string() },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId }) => handle(() => client.submitTaskReview(taskId)),
  );

  server.registerTool(
    "accept_task_review",
    {
      title: "Accept Task Review",
      description: "验收通过：pending_review -> completed。高风险，必须确认。",
      inputSchema: {
        taskId: z.string(),
        confirmed: z.boolean().optional().describe("仅在用户明确确认验收通过后传 true。"),
      },
      annotations: { readOnlyHint: false, destructiveHint: true, openWorldHint: false },
    },
    async ({ taskId, confirmed }) => handle(async () => {
      requireConfirmation(confirmed, "accept_task_review");
      return client.acceptTaskReview(taskId);
    }),
  );

  server.registerTool(
    "return_task_review",
    {
      title: "Return Task Review",
      description: "验收退回：pending_review -> in_progress。",
      inputSchema: {
        taskId: z.string(),
        reason: z.string().optional(),
      },
      annotations: { readOnlyHint: false, openWorldHint: false },
    },
    async ({ taskId, reason }) => handle(() => client.returnTaskReview(taskId, reason ?? "")),
  );
}
