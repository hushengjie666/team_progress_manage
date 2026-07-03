import { createExecutionSignal, type ExecutionSignalSource, type IdFactory } from "./workSessionSignals";
import { latestActiveOrPausedWorkSession } from "./workSessionQueries";
import type { AppState, WorkSession } from "./types";

export const pauseWorkSessionInState = (
  state: AppState,
  timestamp: string,
  taskId?: string,
  workSessionId?: string,
  options: { source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "paused") return state;
  const nextSession: WorkSession = { ...session, status: "paused", pausedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => (item.id === session.id ? nextSession : item)),
    executionSignals: [
      createExecutionSignal(nextSession, "work_paused", timestamp, options.source ? { source: options.source } : undefined, options.idFactory),
      ...state.executionSignals,
    ],
    updatedAt: timestamp,
  };
};

export const resumeWorkSessionInState = (
  state: AppState,
  timestamp: string,
  taskId?: string,
  workSessionId?: string,
  options: { source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "active") return state;
  const pausedSeconds = session.pausedAt
    ? Math.max(0, Math.round((new Date(timestamp).getTime() - new Date(session.pausedAt).getTime()) / 1000))
    : 0;
  const nextSession: WorkSession = {
    ...session,
    status: "active",
    pausedAt: undefined,
    totalPausedSeconds: (session.totalPausedSeconds ?? 0) + pausedSeconds,
    updatedAt: timestamp,
  };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => (item.id === session.id ? nextSession : item)),
    executionSignals: [
      createExecutionSignal(nextSession, "work_resumed", timestamp, options.source ? { source: options.source } : undefined, options.idFactory),
      ...state.executionSignals,
    ],
    updatedAt: timestamp,
  };
};
