import {
  endSessionInState,
  modeLabel,
  nowIso,
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { createAppFocusInterruptionRuntime } from "./appFocusInterruptionRuntime";
import { uid } from "./seed";
import type { AppState, InterruptionAction, InterruptionType, SessionMode, SessionOutcome } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;
type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppFocusActionsRuntimeOptions = {
  getState: () => AppState;
  getQuickNote: () => string;
  updateState: UpdateState;
  setQuickNote: Setter<string>;
  setToast: (message: string) => void;
  setPreferredFocusTaskId: Setter<string | null>;
  setPendingReset: Setter<boolean>;
};

export type AppFocusActionsRuntime = {
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  resetTimer: () => void;
  confirmResetTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
};

export function createAppFocusActionsRuntime({
  getState,
  getQuickNote,
  updateState,
  setQuickNote,
  setToast,
  setPreferredFocusTaskId,
  setPendingReset,
}: AppFocusActionsRuntimeOptions): AppFocusActionsRuntime {
  const beginTimer = async (mode: SessionMode, taskId?: string) => {
    const timestamp = nowIso();
    const sessionId = uid("session");
    if (mode === "focus" && taskId) setPreferredFocusTaskId(taskId);
    updateState((value) => startTimerInState(value, mode, taskId, timestamp, sessionId));
    setToast(`${modeLabel[mode]}已开始`);
  };

  const toggleTimer = () => {
    const timestamp = nowIso();
    updateState((value) => toggleTimerInState(value, timestamp));
  };

  const resetTimer = () => {
    if (getState().activeTimer) setPendingReset(true);
  };

  const confirmResetTimer = () => {
    const timestamp = nowIso();
    updateState((value) =>
      value.activeTimer
        ? {
            ...value,
            activeTimer: {
              ...value.activeTimer,
              remaining: value.activeTimer.duration,
              isRunning: false,
              pausedAt: timestamp,
              plannedEndAt: new Date(new Date(timestamp).getTime() + value.activeTimer.duration * 1000).toISOString(),
              pendingSettlement: undefined,
            },
            updatedAt: timestamp,
          }
        : value,
    );
    setPendingReset(false);
    setToast("当前计时已重置");
  };

  const finishTimer = async (outcome: SessionOutcome) => {
    updateState((value) => endSessionInState(value, outcome));
    setToast(outcome === "completed" ? "番茄已记录" : "当前番茄已作废");
  };

  const { addInterruption } = createAppFocusInterruptionRuntime({
    getState,
    getQuickNote,
    updateState,
    setQuickNote,
    setToast,
  });

  return {
    beginTimer,
    toggleTimer,
    resetTimer,
    confirmResetTimer,
    finishTimer,
    addInterruption,
  };
}
