import type { ProjectTaskInput } from "../../src/projectDetail.js";
import type {
  DailyReview,
  Priority,
  ProjectMemberRole,
  RepeatRule,
  Severity,
  TaskStage,
  TaskStatus,
} from "../../src/types.js";

export type TaskListFilter = {
  projectId?: string;
  status?: TaskStatus | "all";
  assigneeMemberId?: string;
  query?: string;
  includeArchived?: boolean;
  includeSplit?: boolean;
};

export type CreateTaskInput = ProjectTaskInput & {
  projectId: string;
};

export type UpdateTaskInput = Partial<{
  title: string;
  notes: string;
  tags: string[];
  priority: Priority;
  severity: Severity;
  stage: TaskStage;
  estimateHours: number;
  estimatePomodoros: number;
  expectedStartAt: string;
  expectedFinishAt: string;
  dueAt: string;
  reminderAt: string;
  repeatRule: RepeatRule;
  repeatIntervalDays: number;
  subtasks: string[];
}>;

export type CreateProjectInput = {
  name: string;
  description?: string;
  defaultExpectedStartHours?: number;
  taskStageMode?: "regular" | "software";
};

export type UpdateProjectInput = Partial<{
  name: string;
  description: string;
  defaultExpectedStartHours: number;
  taskStageMode: "regular" | "software";
}>;

export type CreateMemberInput = {
  projectId: string;
  name: string;
  email?: string;
  accountId?: string;
  roles?: ProjectMemberRole[];
};

export type UpdateMemberInput = Partial<{
  name: string;
  email: string;
  status: "active" | "disabled";
}>;

export type DailyReviewPatch = Partial<DailyReview> & {
  reflection?: string;
  reviewed?: boolean;
};
