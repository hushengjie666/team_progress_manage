import type {
  Priority,
  RepeatRule,
  Severity,
  Task,
  TaskStage,
  TaskStatus,
} from "./types";

export type IdFactory = (prefix: string) => string;

export type ProjectAccess = {
  canView: boolean;
  canEditTasks: boolean;
  canReviewTasks: boolean;
  memberName?: string;
};

export type ProjectTaskInput = {
  title: string;
  notes?: string;
  tags?: string[];
  priority?: Priority;
  severity?: Severity;
  stage?: TaskStage;
  estimateHours?: number;
  estimatePomodoros?: number;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
  expectedStartAt?: string;
  expectedFinishAt?: string;
  dueAt?: string;
  reminderAt?: string;
  repeatRule?: RepeatRule;
  repeatIntervalDays?: number;
  subtasks?: string[];
};

export type ProjectOverviewTaskGroup = {
  memberId?: string;
  memberName: string;
  tasks: Task[];
  hasActiveTask: boolean;
};

export type ProjectOverviewTaskBoard = {
  poolTasks: Task[];
  pendingReviewTasks: Task[];
  inProgressTasks: Task[];
  todayWorkGroups: ProjectOverviewTaskGroup[];
};

export type ProjectTaskFilters = {
  query: string;
  status: "all" | TaskStatus;
  executor: "all" | "unassigned" | string;
  priority: "all" | Priority;
  sort: "status" | "priority" | "dueAt" | "updatedAt";
};
