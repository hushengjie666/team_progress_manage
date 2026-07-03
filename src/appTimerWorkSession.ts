import type { AppState, WorkSession } from "./types";
import {
  endActiveWorkSessionsForTaskInState as endWorkSessionsForTaskInState,
  endWorkSessionForSwitchInState,
} from "./workSessionTransitions";

export const activeWorkSession = (state: AppState) => {
  const active = state.activeTimer;
  if (!active || active.mode !== "focus") return undefined;
  return state.workSessions.find((session) =>
    active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId,
  );
};

export const endWorkSessionForSwitch = (state: AppState, workSession: WorkSession, timestamp: string, nextTaskId: string): AppState => {
  const active = state.activeTimer?.workSessionId === workSession.id || state.activeTimer?.sessionId === workSession.focusSessionId
    ? state.activeTimer
    : undefined;
  return endWorkSessionForSwitchInState(state, workSession, timestamp, nextTaskId, {
    activeTimerWorkSessionId: active?.workSessionId,
    activeTimerFocusSessionId: active?.sessionId,
    activeTimerTotalPausedSeconds: active?.totalPausedSeconds,
    clearActiveTimer: true,
  });
};

export const endActiveWorkSessionsForTaskInState = (
  state: AppState,
  taskId: string,
  timestamp: string,
  reason = "removed_from_today",
): AppState =>
  endWorkSessionsForTaskInState(state, taskId, timestamp, {
    reason,
    activeTimerWorkSessionId: state.activeTimer?.workSessionId,
    activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
    clearActiveTimer: true,
  });
