import {
  modeLabel,
  nowIso,
  startTimerInState,
  toggleTimerInState,
} from "./appModel";
import { createAppFocusInterruptionRuntime } from "./appFocusInterruptionRuntime";
import { uid } from "./seed";
import type { AppState, InterruptionAction, InterruptionType, SessionMode, SessionOutcome } from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

type UpdateState = (updater: (value: AppState) => AppState) => void;
type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppFocusActionsRuntimeOptions = {
  getState: () => AppState;
  getQuickNote: () => string;
  updateState: UpdateState;
  runTeamCommand: RunTeamDomainCommand;
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
  runTeamCommand,
  setQuickNote,
  setToast,
  setPreferredFocusTaskId,
  setPendingReset,
}: AppFocusActionsRuntimeOptions): AppFocusActionsRuntime {
  const beginTimer = async (mode: SessionMode, taskId?: string) => {
    const timestamp = nowIso();
    const sessionId = uid("session");
    if (mode === "focus" && taskId) {
      const task = getState().tasks.find((item) => item.id === taskId);
      if (!task) return;
      setPreferredFocusTaskId(taskId);
      const saved = await runTeamCommand({ kind: "action", resource: "tasks", id: taskId, action: "start", workspaceId: task.workspaceId, idempotencyKey: `start:${taskId}:${sessionId}` });
      if (!saved) return;
      const activeWork = saved.workSessions.find((item) => item.taskId === taskId && item.status === "active");
      updateState((value) => {
        const projected = startTimerInState(value, mode, taskId, timestamp, sessionId);
        return { ...value, activeTimer: projected.activeTimer ? { ...projected.activeTimer, workSessionId: activeWork?.id } : undefined };
      });
    } else {
      updateState((value) => {
        const projected = startTimerInState(value, mode, taskId, timestamp, sessionId);
        return { ...value, activeTimer: projected.activeTimer };
      });
    }
    setToast(`${modeLabel[mode]}已开始`);
  };

  const toggleTimer = () => {
    const source = getState();
    const active = source.activeTimer;
    if (!active?.workSessionId) return;
    const session = source.workSessions.find((item) => item.id === active.workSessionId);
    if (!session) return;
    const action = active.isRunning ? "pause" : "resume";
    void runTeamCommand({ kind: "action", resource: "work-sessions", id: session.id, action, workspaceId: source.tasks.find((item) => item.id === session.taskId)?.workspaceId })
      .then((saved) => saved && updateState((value) => ({ ...value, activeTimer: toggleTimerInState(value, nowIso()).activeTimer })));
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
    const source = getState();
    const active = source.activeTimer;
    if (active?.workSessionId) {
      const session = source.workSessions.find((item) => item.id === active.workSessionId);
      await runTeamCommand({ kind: "action", resource: "work-sessions", id: active.workSessionId, action: "finish", workspaceId: session ? source.tasks.find((item) => item.id === session.taskId)?.workspaceId : undefined, payload: { outcome } });
    }
    updateState((value) => ({ ...value, activeTimer: undefined }));
    setToast(outcome === "completed" ? "番茄已记录" : "当前番茄已作废");
  };

  const { addInterruption } = createAppFocusInterruptionRuntime({
    getState,
    getQuickNote,
    runTeamCommand,
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
