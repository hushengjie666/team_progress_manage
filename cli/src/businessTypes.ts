import type {
  InterruptionAction,
  InterruptionType,
  ProjectMemberRole,
  RepeatRule,
  SessionOutcome,
  Task,
  TaskStage,
  TaskStageMode,
} from "../../src/types.js";

export type ProjectInput = {
  name: string;
  description?: string;
  defaultExpectedStartHours?: number;
  taskStageMode?: TaskStageMode;
  workspaceId?: string;
};

export type TaskInput = {
  projectId: string;
  title: string;
  notes?: string;
  tags?: string[];
  priority?: Task["priority"];
  severity?: Task["severity"];
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

export type TaskUpdateInput = Partial<Omit<TaskInput, "projectId" | "title">> & {
  title?: string;
};

export type TaskAssignmentInput = {
  projectId?: string;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
};

export type WorkSessionInput = {
  taskId?: string;
  workSessionId?: string;
  outcome?: SessionOutcome;
};

export type MemberInput = {
  projectId: string;
  name: string;
  email?: string;
  accountId?: string;
  roles?: ProjectMemberRole[];
};

export type InterruptionInput = {
  taskId?: string;
  workSessionId?: string;
  type: InterruptionType;
  note?: string;
  action?: InterruptionAction;
};
