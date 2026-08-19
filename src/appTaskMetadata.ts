import type { Priority, RepeatRule, SessionMode, Severity, Subtask, TaskStage, TaskStageMode } from "./types";

export type TaskDraft = {
  title: string;
  project: string;
  tags: string;
  estimatePomodoros: number;
  priority: Priority;
  severity: Severity;
  stage: TaskStage;
  notes: string;
  dueAt: string;
  reminderAt: string;
  repeatRule: RepeatRule;
  repeatIntervalDays: number;
};

export type TaskSort = "createdAt" | "manual" | "dueAt" | "priority" | "estimate";

export type TaskFilters = {
  query: string;
  project: string;
  tag: string;
  priority: "all" | Priority;
  sort: TaskSort;
};

export const initialDraft: TaskDraft = {
  title: "",
  project: "TimeManage",
  tags: "产品, 自律",
  estimatePomodoros: 2,
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  notes: "",
  dueAt: "",
  reminderAt: "",
  repeatRule: "none",
  repeatIntervalDays: 1,
};

export const priorityWeight: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

export const taskStageModeOptions: { value: TaskStageMode; label: string }[] = [
  { value: "regular", label: "常规" },
  { value: "software", label: "软件开发" },
];

export const regularTaskStageOptions: { value: TaskStage; label: string }[] = [
  { value: "planning", label: "规划" },
  { value: "execution", label: "执行" },
  { value: "check", label: "检查" },
];

export const softwareTaskStageOptions: { value: TaskStage; label: string }[] = [
  { value: "sales", label: "销售" },
  { value: "requirements", label: "需求" },
  { value: "design", label: "设计" },
  { value: "development", label: "开发" },
  { value: "testing", label: "测试" },
  { value: "deployment", label: "部署" },
  { value: "acceptance", label: "验收" },
];

export const taskStageOptions: { value: TaskStage; label: string }[] = [
  ...regularTaskStageOptions,
  ...softwareTaskStageOptions,
];

export const taskStageOptionsForMode = (mode: TaskStageMode = "software") =>
  mode === "regular" ? regularTaskStageOptions : softwareTaskStageOptions;

const regularTaskStageValues = new Set<TaskStage>(regularTaskStageOptions.map((option) => option.value));

export const taskStageModeForStage = (stage?: TaskStage): TaskStageMode => (
  stage && regularTaskStageValues.has(stage) ? "regular" : "software"
);

export const defaultTaskStageForMode = (mode: TaskStageMode): TaskStage => (
  mode === "regular" ? "planning" : "requirements"
);

export const labelTaskStage: Record<TaskStage, string> = Object.fromEntries(taskStageOptions.map((option) => [option.value, option.label])) as Record<TaskStage, string>;

export const initialFilters: TaskFilters = { query: "", project: "all", tag: "all", priority: "all", sort: "createdAt" };

export const emptyTaskDefaults = (timestamp: string, sortOrder: number) => ({
  subtasks: [] as Subtask[],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  repeatRule: "none" as RepeatRule,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const formatDateTimeLocal = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const parseDateTimeLocal = (value: string) => (value ? new Date(value).toISOString() : undefined);

export const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export const labelPriority: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const labelSeverity: Record<Severity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  very_high: "非常高",
};

export const modeLabel: Record<SessionMode, string> = {
  focus: "专注番茄",
  short_break: "短休息",
  long_break: "长休息",
};
