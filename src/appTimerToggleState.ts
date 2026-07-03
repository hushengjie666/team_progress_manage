import { pauseTimer, resumeTimer } from "./domain";
import type { AppState, WorkSession } from "./types";
import { createExecutionSignal } from "./workSessionTransitions";
import { activeWorkSession } from "./appTimerWorkSession";

export const toggleTimerInState = (state: AppState, timestamp: string): AppState => {
  const active = state.activeTimer;
  if (!active) return state;
  const timer = active.isRunning ? pauseTimer(active, timestamp) : resumeTimer(active, timestamp);
  const workSession = activeWorkSession(state);
  if (!workSession) {
    return { ...state, activeTimer: timer, updatedAt: timestamp };
  }

  const nextWorkSession: WorkSession = {
    ...workSession,
    status: active.isRunning ? "paused" : "active",
    pausedAt: active.isRunning ? timestamp : undefined,
    totalPausedSeconds: timer.totalPausedSeconds,
    updatedAt: timestamp,
  };
  return {
    ...state,
    activeTimer: timer,
    workSessions: state.workSessions.map((session) => (session.id === workSession.id ? nextWorkSession : session)),
    executionSignals: [
      createExecutionSignal(nextWorkSession, active.isRunning ? "work_paused" : "work_resumed", timestamp),
      ...state.executionSignals,
    ],
    updatedAt: timestamp,
  };
};
