import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

export const taskStatusSchema = z.enum(["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"]);
export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const severitySchema = z.enum(["low", "medium", "high", "very_high"]);
export const stageSchema = z.enum(["sales", "requirements", "design", "development", "testing", "deployment", "acceptance"]);
export const repeatRuleSchema = z.enum(["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"]);
export const projectMemberRoleSchema = z.enum(["project_owner", "executor"]);

export const taskInputSchema = {
  title: z.string(),
  notes: z.string().optional(),
  tags: z.array(z.string()).optional(),
  priority: prioritySchema.optional(),
  severity: severitySchema.optional(),
  stage: stageSchema.optional(),
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

export const jsonResult = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
});

export const textResult = (text: string): CallToolResult => ({
  content: [{ type: "text", text }],
});

export const handle = async (fn: () => Promise<unknown>): Promise<CallToolResult> => {
  try {
    return jsonResult(await fn());
  } catch (error) {
    return {
      isError: true,
      content: [{ type: "text", text: error instanceof Error ? error.message : String(error) }],
    };
  }
};
