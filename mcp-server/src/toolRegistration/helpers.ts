import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  prioritySchema,
  repeatRuleSchema,
  severitySchema,
  taskStageSchema,
  taskStatusSchema,
} from "../schemas.js";
import { handleTool } from "../toolResult.js";

export const registerJsonTool = (
  server: McpServer,
  name: string,
  description: string,
  inputSchema: z.ZodRawShape,
  run: (input: any) => Promise<unknown> | unknown,
  readOnly = false,
) => {
  server.registerTool(
    name,
    {
      title: name,
      description,
      inputSchema,
      annotations: { readOnlyHint: readOnly, openWorldHint: false },
    },
    async (input) => handleTool(() => run(input)),
  );
};

export const confirmedShape = {
  confirmed: z.boolean().optional(),
};

export const workSessionShape = {
  taskId: z.string().optional(),
  workSessionId: z.string().optional(),
};

export const taskListShape = {
  projectId: z.string().optional(),
  status: z.union([taskStatusSchema, z.literal("all")]).optional(),
  assigneeMemberId: z.string().optional(),
  query: z.string().optional(),
  includeArchived: z.boolean().optional(),
  includeSplit: z.boolean().optional(),
};

export const taskUpdateShape = {
  title: z.string().optional(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: prioritySchema.optional(),
  severity: severitySchema.optional(),
  stage: taskStageSchema.optional(),
  estimateHours: z.number().optional(),
  estimatePomodoros: z.number().optional(),
  primaryExecutorMemberId: z.string().optional(),
  collaboratorMemberIds: z.array(z.string()).optional(),
  expectedStartAt: z.string().optional(),
  expectedFinishAt: z.string().optional(),
  dueAt: z.string().optional(),
  reminderAt: z.string().optional(),
  repeatRule: repeatRuleSchema.optional(),
  repeatIntervalDays: z.number().optional(),
  subtasks: z.array(z.string()).optional(),
};
