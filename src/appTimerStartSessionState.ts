import { completedFocusSessions } from "./domain";
import { resolveCurrentMember } from "./memberIdentity";
import { uid } from "./seed";
import type { AppState, FocusSession, SessionMode, WorkSession } from "./types";
import {
  activeWorkSessionForExecutor,
  claimTaskForCurrentMemberIfUnassigned,
  createExecutionSignal,
} from "./workSessionTransitions";
import { getTodayPlan } from "./appTodayPlan";
import { activeWorkSession, endWorkSessionForSwitch } from "./appTimerWorkSession";

export const startTimerInState = (
  state: AppState,
  mode: SessionMode,
  taskId: string | undefined,
  timestamp: string,
  sessionId = uid("session"),
): AppState => {
  const durationMinutes =
    mode === "focus"
      ? state.settings.focusMinutes
      : mode === "short_break"
        ? state.settings.shortBreakMinutes
        : state.settings.longBreakMinutes;
  const session: FocusSession = {
    id: sessionId,
    taskId,
    mode,
    duration: durationMinutes * 60,
    startedAt: timestamp,
    interruptionCounts: { internal: 0, external: 0 },
  };
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : undefined;
  if (
    mode === "focus" &&
    task &&
    (task.status === "pending_review" || task.status === "completed" || task.status === "split" || task.status === "archived")
  ) {
    return state;
  }
  const executorMemberId = task ? claimTaskForCurrentMemberIfUnassigned(state, task) : resolveCurrentMember(state)?.id;
  const timerWorkSession = activeWorkSession(state);
  const currentWorkSession = timerWorkSession?.status === "active" && timerWorkSession.executorMemberId === executorMemberId
    ? timerWorkSession
    : activeWorkSessionForExecutor(state, executorMemberId);
  if (mode === "focus" && taskId && currentWorkSession) {
    if (currentWorkSession.taskId === taskId) return state;
    return startTimerInState(
      endWorkSessionForSwitch(state, currentWorkSession, timestamp, taskId),
      mode,
      taskId,
      timestamp,
      sessionId,
    );
  }
  const workSession: WorkSession | undefined = mode === "focus" && taskId
    ? {
        id: uid("work_session"),
        taskId,
        executorMemberId,
        focusSessionId: session.id,
        status: "active",
        startedAt: timestamp,
        totalPausedSeconds: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    : undefined;
  const nextDailyPlans = mode === "focus" && taskId
    ? (() => {
        const plan = getTodayPlan(state);
        const nextPlan = {
          ...plan,
          committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
          updatedAt: timestamp,
        };
        return state.dailyPlans.some((item) => item.id === nextPlan.id)
          ? state.dailyPlans.map((item) => (item.id === nextPlan.id ? nextPlan : item))
          : [...state.dailyPlans, nextPlan];
      })()
    : state.dailyPlans;
  return {
    ...state,
    dailyPlans: nextDailyPlans,
    focusSessions: [session, ...state.focusSessions],
    workSessions: workSession ? [workSession, ...state.workSessions] : state.workSessions,
    executionSignals: workSession
      ? [createExecutionSignal(workSession, "work_started", timestamp, { mode }), ...state.executionSignals]
      : state.executionSignals,
    activeTimer: {
      sessionId: session.id,
      taskId,
      workSessionId: workSession?.id,
      mode,
      duration: session.duration,
      remaining: session.duration,
      isRunning: true,
      startedAt: timestamp,
      plannedEndAt: new Date(new Date(timestamp).getTime() + session.duration * 1000).toISOString(),
      totalPausedSeconds: 0,
      cycleIndex: completedFocusSessions(state).length + (mode === "focus" ? 1 : 0),
    },
    tasks: taskId
      ? state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(state, task),
                status: "in_progress" as const,
                updatedAt: timestamp,
              }
            : task,
        )
      : state.tasks,
    updatedAt: timestamp,
  };
};
