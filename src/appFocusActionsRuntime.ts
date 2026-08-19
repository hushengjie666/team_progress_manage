import {
  modeLabel,
  nowIso,
  startTimerInState,
  today,
  toggleTimerInState,
} from "./appModel";
import { createAppFocusInterruptionRuntime } from "./appFocusInterruptionRuntime";
import { uid } from "./seed";
import type { AppState, InterruptionAction, InterruptionType, SessionMode, SessionOutcome } from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";
import { workspaceIdForTask } from "./dailyPlanScope";

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
    const sessionId = uid("focus_session");
    if (mode === "focus" && taskId) {
      const source = getState();
      const task = source.tasks.find((item) => item.id === taskId);
      if (!task) return;
      const taskWorkspaceId = workspaceIdForTask(source, task);
      const workSessionId = uid("work_session");
      const previousTask = task;
      const previousTimer = source.activeTimer;
      const previousPlan = source.dailyPlans.find((plan) => plan.workspaceId === taskWorkspaceId && plan.committedTaskIds.includes(taskId));
      setPreferredFocusTaskId(taskId);
      setToast(`${modeLabel[mode]}已开始`);
      await runTeamCommand({
        kind: "action",
        resource: "tasks",
        id: taskId,
        action: "start",
        workspaceId: task.workspaceId,
        payload: {
          focus_session_id: sessionId,
          work_session_id: workSessionId,
          duration: source.settings.focusMinutes * 60,
          date: today(),
        },
        idempotencyKey: `start:${taskId}:${sessionId}`,
      }, {
        resourceKey: `tasks:${taskId}:timer`,
        pendingMode: "background",
        optimistic: (state) => {
          const projected = startTimerInState(state, mode, taskId, timestamp, sessionId, { workSessionId });
          return {
            next: { ...projected, executionSignals: state.executionSignals },
            rollback: (current) => ({
              ...current,
              activeTimer: current.activeTimer?.sessionId === sessionId ? previousTimer : current.activeTimer,
              focusSessions: current.focusSessions.filter((session) => session.id !== sessionId),
              workSessions: current.workSessions.filter((session) => session.id !== workSessionId),
              executionSignals: current.executionSignals.filter((signal) => signal.workSessionId !== workSessionId),
              tasks: current.tasks.map((currentTask) =>
                currentTask.id === taskId && currentTask.updatedAt === timestamp ? previousTask : currentTask,
              ),
              dailyPlans: current.dailyPlans.flatMap((plan) => {
                if (plan.updatedAt !== timestamp || !plan.committedTaskIds.includes(taskId)) return [plan];
                return previousPlan ? [previousPlan] : [];
              }),
            }),
          };
        },
      });
    } else {
      updateState((value) => {
        const projected = startTimerInState(value, mode, taskId, timestamp, sessionId);
        return { ...value, activeTimer: projected.activeTimer };
      });
      setToast(`${modeLabel[mode]}已开始`);
    }
  };

  const toggleTimer = () => {
    const source = getState();
    const active = source.activeTimer;
    if (!active?.workSessionId) return;
    const session = source.workSessions.find((item) => item.id === active.workSessionId);
    const taskId = session?.taskId ?? active.taskId;
    const action = active.isRunning ? "pause" : "resume";
    const resourceKey = `work-sessions:${active.workSessionId}`;
    if (source.backend.pendingResourceKeys?.includes(resourceKey)) return;
    const timestamp = nowIso();
    const previousTimer = active;
    const previousWorkSession = session;
    setToast(active.isRunning ? "番茄已暂停" : "番茄已继续");
    void runTeamCommand({
      kind: "action",
      resource: "work-sessions",
      id: active.workSessionId,
      action,
      workspaceId: source.tasks.find((item) => item.id === taskId)?.workspaceId,
      idempotencyKey: `${action}:${active.workSessionId}:${timestamp}`,
    }, {
      resourceKey,
      pendingMode: "background",
      optimistic: (state) => {
        const projected = toggleTimerInState(state, timestamp);
        return {
          next: { ...projected, executionSignals: state.executionSignals },
          rollback: (current) => ({
            ...current,
            activeTimer: current.activeTimer?.workSessionId === active.workSessionId && current.activeTimer?.isRunning !== previousTimer.isRunning
              ? previousTimer
              : current.activeTimer,
            workSessions: previousWorkSession
              ? current.workSessions.map((item) => item.id === previousWorkSession.id && item.updatedAt === timestamp ? previousWorkSession : item)
              : current.workSessions,
          }),
        };
      },
    });
  };

  const resetTimer = () => {
    if (getState().activeTimer) setPendingReset(true);
  };

  const confirmResetTimer = () => {
    const source = getState();
    const active = source.activeTimer;
    if (!active) return;
    const timestamp = nowIso();
    setPendingReset(false);
    setToast("当前计时已重置");
    const resetState = (value: AppState) => value.activeTimer
      ? {
          ...value,
          activeTimer: {
            ...value.activeTimer,
            remaining: value.activeTimer.duration,
            isRunning: false,
            startedAt: timestamp,
            pausedAt: timestamp,
            totalPausedSeconds: 0,
            plannedEndAt: new Date(new Date(timestamp).getTime() + value.activeTimer.duration * 1000).toISOString(),
            pendingSettlement: undefined,
          },
          updatedAt: timestamp,
        }
      : value;
    if (!active.workSessionId) {
      updateState(resetState);
      return;
    }
    const workSession = source.workSessions.find((item) => item.id === active.workSessionId);
    const resourceKey = `work-sessions:${active.workSessionId}`;
    if (source.backend.pendingResourceKeys?.includes(resourceKey)) return;
    void runTeamCommand({
      kind: "action",
      resource: "work-sessions",
      id: active.workSessionId,
      action: "reset",
      workspaceId: source.tasks.find((item) => item.id === (workSession?.taskId ?? active.taskId))?.workspaceId,
      idempotencyKey: `reset:${active.workSessionId}:${timestamp}`,
    }, {
      resourceKey,
      pendingMode: "background",
      optimistic: (state) => ({
        next: resetState(state),
        rollback: (current) => ({
          ...current,
          activeTimer: current.activeTimer?.workSessionId === active.workSessionId && current.activeTimer?.startedAt === timestamp
            ? active
            : current.activeTimer,
          workSessions: workSession
            ? current.workSessions.map((item) => item.id === workSession.id && item.updatedAt === timestamp ? workSession : item)
            : current.workSessions,
        }),
      }),
    });
  };

  const finishTimer = async (outcome: SessionOutcome) => {
    const source = getState();
    const active = source.activeTimer;
    if (active?.workSessionId) {
      const session = source.workSessions.find((item) => item.id === active.workSessionId);
      const saved = await runTeamCommand({ kind: "action", resource: "work-sessions", id: active.workSessionId, action: "finish", workspaceId: source.tasks.find((item) => item.id === (session?.taskId ?? active.taskId))?.workspaceId, payload: { outcome } });
      if (!saved) return;
    } else {
      updateState((value) => ({ ...value, activeTimer: undefined }));
    }
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
