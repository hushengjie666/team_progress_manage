export type Priority = "low" | "medium" | "high" | "urgent";
export type Severity = "low" | "medium" | "high" | "very_high";
export type TaskStage =
  | "planning"
  | "execution"
  | "check"
  | "sales"
  | "requirements"
  | "design"
  | "development"
  | "testing"
  | "deployment"
  | "acceptance";
export type TaskStageMode = "regular" | "software";
export type TaskStatus = "pool" | "committed" | "in_progress" | "pending_review" | "completed" | "split" | "archived";
export type RepeatRule = "none" | "daily" | "weekly" | "interval" | "weekdays" | "monthly" | "after_completion";

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  createdAt: string;
  completedAt?: string;
}

export interface EstimateEntry {
  id: string;
  estimatedPomodoros: number;
  actualPomodoros: number;
  recordedAt: string;
  source: "completion" | "manual";
}

export interface Task {
  id: string;
  workspaceId?: string;
  title: string;
  notes: string;
  tags: string[];
  projectId: string;
  project: string;
  creatorMemberId?: string;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
  expectedStartAt?: string;
  expectedFinishAt?: string;
  progressPercent?: number;
  progressNote?: string;
  priority: Priority;
  severity: Severity;
  stage: TaskStage;
  estimatePomodoros: number;
  status: TaskStatus;
  dueAt?: string;
  reminderAt?: string;
  repeatRule?: RepeatRule;
  repeatIntervalDays?: number;
  repeatWeekdays?: number[];
  repeatDayOfMonth?: number;
  recurrenceParentId?: string;
  nextRepeatAt?: string;
  lastReminderSentAt?: string;
  subtasks: Subtask[];
  sortOrder: number;
  actualPomodoros: number;
  estimateHistory: EstimateEntry[];
  createdAt: string;
  updatedAt: string;
  reviewSubmittedAt?: string;
  reviewSubmittedByMemberId?: string;
  reviewAcceptedAt?: string;
  reviewAcceptedByMemberId?: string;
  reviewReturnedAt?: string;
  reviewReturnedByMemberId?: string;
  reviewReturnReason?: string;
  completedAt?: string;
}

export interface TaskTemplate {
  id: string;
  name: string;
  description: string;
  project: string;
  tags: string[];
  priority: Priority;
  severity: Severity;
  stage?: TaskStage;
  estimatePomodoros: number;
  subtasks: string[];
  repeatRule?: RepeatRule;
}

export interface TemplateInstance {
  templateId: string;
  taskId: string;
  createdAt: string;
}

export interface ParsedQuickInput {
  title: string;
  tags: string[];
  project?: string;
  estimatePomodoros: number;
  dueAt?: string;
  priority?: Priority;
}
