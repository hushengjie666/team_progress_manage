import type {
  DailyPlan,
  ExecutionSignal,
  FocusSession,
  Interruption,
  Project,
  ProjectMember,
  RewardState,
  Settings,
  Task,
  WorkSession,
} from "./types";

export type SyncEntity =
  | "project"
  | "project_member"
  | "task"
  | "daily_plan"
  | "focus_session"
  | "work_session"
  | "execution_signal"
  | "interruption"
  | "settings"
  | "reward_state";

export type SyncPayload =
  | Project
  | ProjectMember
  | Task
  | DailyPlan
  | FocusSession
  | WorkSession
  | ExecutionSignal
  | Interruption
  | Settings
  | RewardState;

export interface SyncMergeRow {
  workspace_id?: string;
  entity: SyncEntity;
  id: string;
  updated_at: string;
  deleted_at?: string;
  payload: unknown;
}

export type SyncMergeOptions = { forceRemote?: boolean };

export const singletonEntities: SyncEntity[] = ["settings", "reward_state"];
