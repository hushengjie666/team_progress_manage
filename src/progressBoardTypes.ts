export type StalledTaskRiskKind = "not_started" | "started_stale" | "finish_late";

export interface StalledTaskRisk {
  taskId: string;
  kind: StalledTaskRiskKind;
  expectedStartAt?: string;
  expectedFinishAt?: string;
  latestSignalAt?: string;
  detail: string;
}

export type ProgressBoardSectionKind =
  | "assigned_not_started"
  | "stalled"
  | "blocked"
  | "pending_review"
  | "near_finish"
  | "normal";

export interface ProgressBoardTask {
  taskId: string;
  title: string;
  executorName?: string;
  progressPercent: number;
  progressNote?: string;
  expectedStartAt?: string;
  expectedFinishAt?: string;
  detail: string;
}

export interface ProgressBoardSection {
  kind: ProgressBoardSectionKind;
  title: string;
  tasks: ProgressBoardTask[];
}

export interface ProgressBoardActiveSession {
  workSessionId: string;
  taskId: string;
  taskTitle: string;
  executorName?: string;
  startedAt: string;
  elapsedSeconds: number;
}

export interface ProgressBoard {
  projectId: string;
  projectName: string;
  projectProgress: number;
  activeSessions: ProgressBoardActiveSession[];
  sections: ProgressBoardSection[];
}
