import { calculateRemaining, nextBreakMode, restoreTimer } from "./domain";
import type { AppState } from "./types";
import { nowIso } from "./appClock";
import { endSessionInState } from "./appTimerEndSessionState";
import { prepareTimerStageInState } from "./appTimerStartSessionState";

export const shouldFinishExpiredTimerInState = (state: AppState, timestamp = nowIso()) => {
  const active = state.activeTimer;
  return Boolean(active?.pendingSettlement === "pending" || (active?.isRunning && calculateRemaining(active, new Date(timestamp)) <= 0));
};

export const finishExpiredTimerInState = (state: AppState, timestamp = nowIso()): AppState => {
  const active = state.activeTimer;
  if (!active) return state;
  const ended = endSessionInState(state, "completed", timestamp);
  if (active.mode === "focus") {
    return prepareTimerStageInState(ended, nextBreakMode(ended), undefined, timestamp);
  }
  const nextTask = ended.tasks.find((task) => task.status === "committed" || task.status === "in_progress");
  return prepareTimerStageInState(ended, "focus", nextTask?.id, timestamp);
};

export const restoreTimerInState = (state: AppState, timestamp = nowIso()): AppState => {
  const active = state.activeTimer;
  if (!active) return state;
  if (shouldFinishExpiredTimerInState(state, timestamp)) {
    return finishExpiredTimerInState(state, timestamp);
  }
  return {
    ...state,
    activeTimer: restoreTimer(active, new Date(timestamp)),
    updatedAt: timestamp,
  };
};
