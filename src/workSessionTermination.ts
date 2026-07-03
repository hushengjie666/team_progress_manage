import { createExecutionSignal, type ExecutionSignalSource, type IdFactory } from "./workSessionSignals";
import type { AppState, WorkSession } from "./types";

export const endWorkSessionForSwitchInState = (
  state: AppState,
  workSession: WorkSession,
  timestamp: string,
  nextTaskId: string,
  options: {
    activeTimerWorkSessionId?: string;
    activeTimerFocusSessionId?: string;
    activeTimerTotalPausedSeconds?: number;
    source?: ExecutionSignalSource;
    idFactory?: IdFactory;
    clearActiveTimer?: boolean;
  } = {},
): AppState => {
  const isActiveTimerSession =
    options.activeTimerWorkSessionId === workSession.id || options.activeTimerFocusSessionId === workSession.focusSessionId;
  const endedWorkSession: WorkSession = {
    ...workSession,
    status: "ended",
    pausedAt: undefined,
    endedAt: timestamp,
    totalPausedSeconds: isActiveTimerSession && options.activeTimerTotalPausedSeconds !== undefined
      ? options.activeTimerTotalPausedSeconds
      : workSession.totalPausedSeconds,
    updatedAt: timestamp,
  };
  return {
    ...state,
    focusSessions: state.focusSessions.map((session) =>
      session.id === workSession.focusSessionId ? { ...session, endedAt: timestamp, outcome: "skipped" as const } : session,
    ),
    workSessions: state.workSessions.map((session) => (session.id === workSession.id ? endedWorkSession : session)),
    executionSignals: [
      createExecutionSignal(
        endedWorkSession,
        "work_ended",
        timestamp,
        { outcome: "skipped", reason: "task_switch", nextTaskId, ...(options.source ? { source: options.source } : {}) },
        options.idFactory,
      ),
      ...state.executionSignals,
    ],
    activeTimer: options.clearActiveTimer && isActiveTimerSession ? undefined : state.activeTimer,
    updatedAt: timestamp,
  };
};

export const endActiveWorkSessionsForTaskInState = (
  state: AppState,
  taskId: string,
  timestamp: string,
  options: {
    reason?: string;
    source?: ExecutionSignalSource;
    activeTimerWorkSessionId?: string;
    activeTimerTotalPausedSeconds?: number;
    clearActiveTimer?: boolean;
    idFactory?: IdFactory;
  } = {},
): AppState => {
  const sessionsToEnd = state.workSessions.filter(
    (session) => session.taskId === taskId && (session.status === "active" || session.status === "paused"),
  );
  const shouldClearActiveTimer = options.clearActiveTimer && state.activeTimer?.taskId === taskId;
  if (sessionsToEnd.length === 0 && !shouldClearActiveTimer) return state;

  const endedSessionIds = new Set(sessionsToEnd.map((session) => session.id));
  const endedFocusSessionIds = new Set(sessionsToEnd.map((session) => session.focusSessionId).filter(Boolean));
  const nextWorkSessions = state.workSessions.map((session) =>
    endedSessionIds.has(session.id)
      ? {
          ...session,
          status: "ended" as const,
          pausedAt: undefined,
          endedAt: timestamp,
          totalPausedSeconds:
            options.activeTimerWorkSessionId === session.id && options.activeTimerTotalPausedSeconds !== undefined
              ? options.activeTimerTotalPausedSeconds
              : session.totalPausedSeconds,
          updatedAt: timestamp,
        }
      : session,
  );
  const endedWorkSessions = nextWorkSessions.filter((session) => endedSessionIds.has(session.id));
  const reason = options.reason ?? "removed_from_today";

  return {
    ...state,
    focusSessions: state.focusSessions.map((session) =>
      endedFocusSessionIds.has(session.id) && !session.endedAt
        ? { ...session, endedAt: timestamp, outcome: "skipped" as const }
        : session,
    ),
    workSessions: nextWorkSessions,
    executionSignals: [
      ...endedWorkSessions.map((session) =>
        createExecutionSignal(
          session,
          "work_ended",
          timestamp,
          { outcome: "skipped", reason, ...(options.source ? { source: options.source } : {}) },
          options.idFactory,
        ),
      ),
      ...state.executionSignals,
    ],
    activeTimer: shouldClearActiveTimer ? undefined : state.activeTimer,
    updatedAt: timestamp,
  };
};
