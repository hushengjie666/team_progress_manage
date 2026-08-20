import { completedFocusSessions } from "./domain";
import { resolveCurrentMember } from "./memberIdentity";
import { todayKey, uid } from "./seed";
import type { AppState, FocusSession, SessionMode, WorkSession } from "./types";
import {
  activeWorkSessionForExecutor,
  claimTaskForCurrentMemberIfUnassigned,
  createExecutionSignal,
  ensurePlanInState,
} from "./workSessionTransitions";
import { activeWorkSession, endWorkSessionForSwitch } from "./appTimerWorkSession";
import { workspaceIdForTask } from "./dailyPlanScope";
import { normalizeTimerSpeedMultiplier, plannedTimerEndAt, timerSpeedMultiplierForSettings } from "./timerSpeed";

type StartTimerOptions = {
  startPaused?: boolean;
  workSessionId?: string;
};

const timerDurationSeconds = (state: AppState, mode: SessionMode) => {
  const durationMinutes =
    mode === "focus"
      ? state.settings.focusMinutes
      : mode === "short_break"
        ? state.settings.shortBreakMinutes
        : state.settings.longBreakMinutes;
  return durationMinutes * 60;
};

export const prepareTimerStageInState = (
  state: AppState,
  mode: SessionMode,
  taskId: string | undefined,
  timestamp: string,
): AppState => {
  const speedMultiplier = timerSpeedMultiplierForSettings(state.settings);
  const normalizedSpeedMultiplier = normalizeTimerSpeedMultiplier(speedMultiplier);
  const duration = timerDurationSeconds(state, mode);
  return {
    ...state,
    activeTimer: {
      sessionId: uid("prepared_session"),
      taskId,
      mode,
      duration,
      remaining: duration,
      isRunning: false,
      startedAt: timestamp,
      plannedEndAt: plannedTimerEndAt(timestamp, duration, normalizedSpeedMultiplier),
      pausedAt: timestamp,
      totalPausedSeconds: 0,
      cycleIndex: completedFocusSessions(state).length + (mode === "focus" ? 1 : 0),
      speedMultiplier: normalizedSpeedMultiplier > 1 ? normalizedSpeedMultiplier : undefined,
      prepared: true,
    },
    updatedAt: timestamp,
  };
};

export const startTimerInState = (
  state: AppState,
  mode: SessionMode,
  taskId: string | undefined,
  timestamp: string,
  sessionId = uid("session"),
  options: StartTimerOptions = {},
): AppState => {
  const startPaused = Boolean(options.startPaused);
  const speedMultiplier = timerSpeedMultiplierForSettings(state.settings);
  const normalizedSpeedMultiplier = normalizeTimerSpeedMultiplier(speedMultiplier);
  const duration = timerDurationSeconds(state, mode);
  const session: FocusSession = {
    id: sessionId,
    taskId,
    mode,
    duration,
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
    if (currentWorkSession.taskId === taskId && state.activeTimer?.workSessionId === currentWorkSession.id) return state;
    return startTimerInState(
      endWorkSessionForSwitch(state, currentWorkSession, timestamp, taskId),
      mode,
      taskId,
      timestamp,
      sessionId,
      options,
    );
  }
  const workSession: WorkSession | undefined = mode === "focus" && taskId
    ? {
        id: options.workSessionId ?? uid("work_session"),
        taskId,
        executorMemberId,
        focusSessionId: session.id,
        status: startPaused ? "paused" : "active",
        startedAt: timestamp,
        pausedAt: startPaused ? timestamp : undefined,
        totalPausedSeconds: 0,
        createdAt: timestamp,
        updatedAt: timestamp,
      }
    : undefined;
  const stateWithPlan = mode === "focus" && task
    ? ensurePlanInState(state, todayKey(), timestamp, workspaceIdForTask(state, task)).state
    : state;
  const nextDailyPlans = mode === "focus" && taskId
    ? (() => {
        const plan = ensurePlanInState(stateWithPlan, todayKey(), timestamp, task ? workspaceIdForTask(stateWithPlan, task) : undefined).plan;
        const nextPlan = {
          ...plan,
          committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
          updatedAt: timestamp,
        };
        return stateWithPlan.dailyPlans.map((item) => (item.id === nextPlan.id ? nextPlan : item));
      })()
    : stateWithPlan.dailyPlans;
  return {
    ...stateWithPlan,
    dailyPlans: nextDailyPlans,
    focusSessions: [session, ...stateWithPlan.focusSessions],
    workSessions: workSession ? [workSession, ...stateWithPlan.workSessions] : stateWithPlan.workSessions,
    executionSignals: workSession
      ? [
          createExecutionSignal(workSession, startPaused ? "work_paused" : "work_started", timestamp, { mode }),
          ...stateWithPlan.executionSignals,
        ]
      : stateWithPlan.executionSignals,
    activeTimer: {
      sessionId: session.id,
      taskId,
      workSessionId: workSession?.id,
      mode,
      duration: session.duration,
      remaining: session.duration,
      isRunning: !startPaused,
      startedAt: timestamp,
      plannedEndAt: plannedTimerEndAt(timestamp, session.duration, normalizedSpeedMultiplier),
      pausedAt: startPaused ? timestamp : undefined,
      totalPausedSeconds: 0,
      cycleIndex: completedFocusSessions(stateWithPlan).length + (mode === "focus" ? 1 : 0),
      speedMultiplier: normalizedSpeedMultiplier > 1 ? normalizedSpeedMultiplier : undefined,
    },
    tasks: taskId
      ? stateWithPlan.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(stateWithPlan, task),
                status: "in_progress" as const,
                updatedAt: timestamp,
              }
            : task,
        )
      : stateWithPlan.tasks,
    updatedAt: timestamp,
  };
};
