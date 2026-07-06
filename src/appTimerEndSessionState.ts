import { deriveRewardState } from "./domain";
import type { AppState, SessionOutcome, WorkSession } from "./types";
import { createExecutionSignal } from "./workSessionTransitions";
import { nowIso, today } from "./appClock";
import { activeWorkSession } from "./appTimerWorkSession";
import { dailyPlanBelongsToCurrentAccount } from "./dailyPlanScope";

export const endSessionInState = (state: AppState, outcome: SessionOutcome, timestamp = nowIso()): AppState => {
  const active = state.activeTimer;
  if (!active) return state;

  const endedAt = timestamp;
  const isFocusCompleted = active.mode === "focus" && outcome === "completed";
  const workSession = activeWorkSession(state);
  const endedWorkSession: WorkSession | undefined = workSession
    ? {
        ...workSession,
        status: "ended",
        pausedAt: undefined,
        endedAt,
        totalPausedSeconds: active.totalPausedSeconds,
        updatedAt: endedAt,
      }
    : undefined;
  const sessions = state.focusSessions.map((session) =>
    session.id === active.sessionId
      ? {
          ...session,
          endedAt,
          outcome,
        }
      : session,
  );

  const plans = state.dailyPlans.map((plan) =>
    plan.date === today() &&
    isFocusCompleted &&
    active.taskId &&
    dailyPlanBelongsToCurrentAccount(state, plan) &&
    plan.committedTaskIds.includes(active.taskId)
      ? { ...plan, completedPomodoros: plan.completedPomodoros + 1, updatedAt: endedAt }
      : plan,
  );

  const tasks = isFocusCompleted
    ? state.tasks.map((task) =>
        task.id === active.taskId
          ? {
              ...task,
              status: "in_progress" as const,
              actualPomodoros: (task.actualPomodoros ?? 0) + 1,
              updatedAt: endedAt,
            }
          : task,
      )
    : state.tasks;

  const nextState = {
    ...state,
    tasks,
    dailyPlans: plans,
    focusSessions: sessions,
    workSessions: endedWorkSession
      ? state.workSessions.map((session) => (session.id === endedWorkSession.id ? endedWorkSession : session))
      : state.workSessions,
    executionSignals: endedWorkSession
      ? [createExecutionSignal(endedWorkSession, "work_ended", endedAt, { outcome }), ...state.executionSignals]
      : state.executionSignals,
    activeTimer: undefined,
    updatedAt: endedAt,
  };
  return {
    ...nextState,
    rewardState: isFocusCompleted ? deriveRewardState(nextState, endedAt) : state.rewardState,
  };
};
