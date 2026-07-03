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
  | "settings"
  | "reward_state"
  | "project"
  | "project_member"
  | "task"
  | "work_session"
  | "execution_signal"
  | "daily_plan"
  | "focus_session"
  | "interruption";

export type SyncPayload =
  | Settings
  | RewardState
  | Project
  | ProjectMember
  | Task
  | WorkSession
  | ExecutionSignal
  | DailyPlan
  | FocusSession
  | Interruption;

export interface SyncChange {
  workspace_id?: string;
  account_id?: string;
  entity: SyncEntity;
  id: string;
  device_id: string;
  updated_at: string;
  deleted_at?: string;
  payload: SyncPayload | Record<string, never>;
}

export interface SyncRow extends SyncChange {
  revision: number;
  version: number;
}
