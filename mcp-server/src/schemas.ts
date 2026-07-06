import { z } from "zod";

export const taskStatusSchema = z.enum(["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"]);
export const prioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const severitySchema = z.enum(["low", "medium", "high", "very_high"]);
export const taskStageSchema = z.enum([
  "planning",
  "execution",
  "check",
  "sales",
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "acceptance",
]);
export const repeatRuleSchema = z.enum(["none", "daily", "weekly", "interval", "weekdays", "monthly", "after_completion"]);
export const projectMemberRoleSchema = z.enum(["project_owner", "executor"]);
export const workspaceTypeSchema = z.enum(["private", "shared"]);
export const workspaceRoleSchema = z.enum(["owner", "admin", "member"]);
export const workspaceMemberStatusSchema = z.enum(["active", "disabled"]);
export const accountStatusSchema = z.enum(["active", "disabled"]);
export const sessionOutcomeSchema = z.enum(["completed", "aborted", "skipped"]);
export const interruptionTypeSchema = z.enum(["internal", "external"]);
export const interruptionActionSchema = z.enum(["defer", "inbox", "abort"]);
export const whiteNoiseSchema = z.enum(["off", "rain", "brown", "cafe"]);
export const timerEndSoundSchema = z.enum(["soft", "bell", "digital"]);

export const taskInputShape = {
  title: z.string(),
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

export const settingsInputShape = {
  focusMinutes: z.number().optional(),
  shortBreakMinutes: z.number().optional(),
  longBreakMinutes: z.number().optional(),
  longBreakEvery: z.number().optional(),
  autoStartBreaks: z.boolean().optional(),
  autoStartFocus: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
  soundEnabled: z.boolean().optional(),
  whiteNoise: whiteNoiseSchema.optional(),
  whiteNoiseVolume: z.number().optional(),
  timerEndSound: timerEndSoundSchema.optional(),
};
