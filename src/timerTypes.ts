export type SessionMode = "focus" | "short_break" | "long_break";
export type SessionOutcome = "completed" | "aborted" | "skipped";
export type TimerSettlement = "pending" | "none";
export type WorkSessionStatus = "active" | "paused" | "ended";
export type ExecutionSignalType = "work_started" | "work_paused" | "work_resumed" | "work_ended";

export interface FocusSession {
  id: string;
  workspaceId?: string;
  taskId?: string;
  mode: SessionMode;
  duration: number;
  startedAt: string;
  endedAt?: string;
  outcome?: SessionOutcome;
  interruptionCounts: {
    internal: number;
    external: number;
  };
}

export interface WorkSession {
  id: string;
  workspaceId?: string;
  taskId: string;
  executorMemberId?: string;
  focusSessionId: string;
  status: WorkSessionStatus;
  startedAt: string;
  pausedAt?: string;
  endedAt?: string;
  totalPausedSeconds: number;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionSignal {
  id: string;
  workspaceId?: string;
  workSessionId: string;
  taskId: string;
  executorMemberId?: string;
  type: ExecutionSignalType;
  createdAt: string;
  payload?: Record<string, unknown>;
}

export interface ActiveTimer {
  sessionId: string;
  taskId?: string;
  workSessionId?: string;
  mode: SessionMode;
  duration: number;
  remaining: number;
  isRunning: boolean;
  startedAt: string;
  plannedEndAt: string;
  pausedAt?: string;
  totalPausedSeconds: number;
  cycleIndex: number;
  pendingSettlement?: TimerSettlement;
}
