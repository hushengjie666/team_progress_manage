import { defaultReview } from "./domain";
import { resolveMemberIdForProject } from "./memberIdentity";
import { todayKey, uid } from "./seed";
import type {
  AppState,
  DailyPlan,
  ExecutionSignal,
  ExecutionSignalType,
  FocusSession,
  SessionOutcome,
  Task,
  WorkSession,
} from "./types";

export type IdFactory = (prefix: string) => string;

export type ExecutionSignalSource = "app" | "mcp";

export const createExecutionSignal = (
  workSession: WorkSession,
  type: ExecutionSignalType,
  timestamp: string,
  payload?: Record<string, unknown>,
  idFactory: IdFactory = uid,
): ExecutionSignal => ({
  id: idFactory("signal"),
  workSessionId: workSession.id,
  taskId: workSession.taskId,
  executorMemberId: workSession.executorMemberId,
  type,
  createdAt: timestamp,
  payload,
});

export const sortedByUpdatedAt = <T extends { updatedAt: string }>(items: T[]) =>
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

export const latestActiveOrPausedWorkSession = (state: AppState, taskId?: string, workSessionId?: string) =>
  sortedByUpdatedAt(state.workSessions)
    .filter((session) => session.status === "active" || session.status === "paused")
    .find((session) => (workSessionId ? session.id === workSessionId : true) && (taskId ? session.taskId === taskId : true));

export const activeWorkSessionForExecutor = (state: AppState, executorMemberId?: string) =>
  state.workSessions.find((session) => (session.status === "active" || session.status === "paused") && session.executorMemberId === executorMemberId);

export const ensurePlanInState = (state: AppState, date: string, timestamp: string): { state: AppState; plan: DailyPlan } => {
  const existing = state.dailyPlans.find((plan) => plan.date === date);
  if (existing) return { state, plan: existing };

  const plan: DailyPlan = {
    id: `plan_${date}`,
    date,
    capacityPomodoros: Math.max(4, state.rewardState.dailyGoal),
    committedTaskIds: [],
    completedPomodoros: 0,
    suggestedTaskIds: [],
    reflection: "",
    review: defaultReview(),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return { state: { ...state, dailyPlans: [plan, ...state.dailyPlans], updatedAt: timestamp }, plan };
};

export const ensureTodayPlanInState = (state: AppState, timestamp: string) => ensurePlanInState(state, todayKey(), timestamp);

export const currentProjectMemberIdForTask = (state: AppState, task: Task) => {
  return resolveMemberIdForProject(state, task.projectId);
};

export const claimTaskForCurrentMemberIfUnassigned = (state: AppState, task: Task) => {
  if (task.primaryExecutorMemberId || (task.collaboratorMemberIds ?? []).length > 0) return task.primaryExecutorMemberId;
  return currentProjectMemberIdForTask(state, task);
};

export const addTaskToTodayInState = (state: AppState, taskId: string, timestamp: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const { state: withPlan, plan } = ensureTodayPlanInState(state, timestamp);
  const committedTaskIds = Array.from(new Set([...plan.committedTaskIds, taskId]));
  return {
    ...withPlan,
    tasks: withPlan.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(withPlan, item),
            status: item.status === "pool" ? "committed" as const : item.status,
            updatedAt: timestamp,
          }
        : item,
    ),
    dailyPlans: withPlan.dailyPlans.map((item) => (item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
};

export const removeTaskFromTodayQueueInState = (state: AppState, taskId: string, timestamp: string) => ({
  ...state,
  tasks: state.tasks.map((task) =>
    task.id === taskId && task.status === "committed" ? { ...task, status: "pool" as const, updatedAt: timestamp } : task,
  ),
  dailyPlans: state.dailyPlans.map((plan) =>
    plan.committedTaskIds.includes(taskId)
      ? { ...plan, committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId), updatedAt: timestamp }
      : plan,
  ),
  updatedAt: timestamp,
});

export const endWorkSessionForSwitchInState = (
  state: AppState,
  workSession: WorkSession,
  timestamp: string,
  nextTaskId: string,
  options: {
    activeTimerWorkSessionId?: string;
    activeTimerFocusSessionId?: string;
    activeTimerTotalPausedSeconds?: number;
    source?: ExecutionSignalSource;
    idFactory?: IdFactory;
    clearActiveTimer?: boolean;
  } = {},
): AppState => {
  const isActiveTimerSession =
    options.activeTimerWorkSessionId === workSession.id || options.activeTimerFocusSessionId === workSession.focusSessionId;
  const endedWorkSession: WorkSession = {
    ...workSession,
    status: "ended",
    pausedAt: undefined,
    endedAt: timestamp,
    totalPausedSeconds: isActiveTimerSession && options.activeTimerTotalPausedSeconds !== undefined
      ? options.activeTimerTotalPausedSeconds
      : workSession.totalPausedSeconds,
    updatedAt: timestamp,
  };
  return {
    ...state,
    focusSessions: state.focusSessions.map((session) =>
      session.id === workSession.focusSessionId ? { ...session, endedAt: timestamp, outcome: "skipped" as const } : session,
    ),
    workSessions: state.workSessions.map((session) => (session.id === workSession.id ? endedWorkSession : session)),
    executionSignals: [
      createExecutionSignal(
        endedWorkSession,
        "work_ended",
        timestamp,
        { outcome: "skipped", reason: "task_switch", nextTaskId, ...(options.source ? { source: options.source } : {}) },
        options.idFactory,
      ),
      ...state.executionSignals,
    ],
    activeTimer: options.clearActiveTimer && isActiveTimerSession ? undefined : state.activeTimer,
    updatedAt: timestamp,
  };
};

export const endActiveWorkSessionsForTaskInState = (
  state: AppState,
  taskId: string,
  timestamp: string,
  options: {
    reason?: string;
    source?: ExecutionSignalSource;
    activeTimerWorkSessionId?: string;
    activeTimerTotalPausedSeconds?: number;
    clearActiveTimer?: boolean;
    idFactory?: IdFactory;
  } = {},
): AppState => {
  const sessionsToEnd = state.workSessions.filter(
    (session) => session.taskId === taskId && (session.status === "active" || session.status === "paused"),
  );
  const shouldClearActiveTimer = options.clearActiveTimer && state.activeTimer?.taskId === taskId;
  if (sessionsToEnd.length === 0 && !shouldClearActiveTimer) return state;

  const endedSessionIds = new Set(sessionsToEnd.map((session) => session.id));
  const endedFocusSessionIds = new Set(sessionsToEnd.map((session) => session.focusSessionId).filter(Boolean));
  const nextWorkSessions = state.workSessions.map((session) =>
    endedSessionIds.has(session.id)
      ? {
          ...session,
          status: "ended" as const,
          pausedAt: undefined,
          endedAt: timestamp,
          totalPausedSeconds:
            options.activeTimerWorkSessionId === session.id && options.activeTimerTotalPausedSeconds !== undefined
              ? options.activeTimerTotalPausedSeconds
              : session.totalPausedSeconds,
          updatedAt: timestamp,
        }
      : session,
  );
  const endedWorkSessions = nextWorkSessions.filter((session) => endedSessionIds.has(session.id));
  const reason = options.reason ?? "removed_from_today";

  return {
    ...state,
    focusSessions: state.focusSessions.map((session) =>
      endedFocusSessionIds.has(session.id) && !session.endedAt
        ? { ...session, endedAt: timestamp, outcome: "skipped" as const }
        : session,
    ),
    workSessions: nextWorkSessions,
    executionSignals: [
      ...endedWorkSessions.map((session) =>
        createExecutionSignal(
          session,
          "work_ended",
          timestamp,
          { outcome: "skipped", reason, ...(options.source ? { source: options.source } : {}) },
          options.idFactory,
        ),
      ),
      ...state.executionSignals,
    ],
    activeTimer: shouldClearActiveTimer ? undefined : state.activeTimer,
    updatedAt: timestamp,
  };
};

export const startWorkSessionInState = (
  state: AppState,
  taskId: string,
  timestamp: string,
  options: { source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status === "pending_review" || task.status === "completed" || task.status === "archived" || task.status === "split") {
    throw new Error(`Task ${taskId} cannot be started from status ${task.status}.`);
  }

  let next = addTaskToTodayInState(state, taskId, timestamp);
  const currentTask = next.tasks.find((item) => item.id === taskId)!;
  const executorMemberId = currentTask.primaryExecutorMemberId ?? resolveMemberIdForProject(next, currentTask.projectId);
  const activeForExecutor = executorMemberId
    ? next.workSessions.find((session) => session.status === "active" && session.executorMemberId === executorMemberId)
    : undefined;

  if (activeForExecutor?.taskId === taskId) return next;

  const endedSession: WorkSession | undefined = activeForExecutor
    ? {
        ...activeForExecutor,
        status: "ended",
        pausedAt: undefined,
        endedAt: timestamp,
        updatedAt: timestamp,
      }
    : undefined;

  const idFactory = options.idFactory ?? uid;
  const focusSession: FocusSession = {
    id: idFactory("session"),
    taskId,
    mode: "focus",
    duration: next.settings.focusMinutes * 60,
    startedAt: timestamp,
    interruptionCounts: { internal: 0, external: 0 },
  };
  const workSession: WorkSession = {
    id: idFactory("work_session"),
    taskId,
    executorMemberId,
    focusSessionId: focusSession.id,
    status: "active",
    startedAt: timestamp,
    totalPausedSeconds: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const signals = [
    createExecutionSignal(workSession, "work_started", timestamp, options.source ? { source: options.source } : undefined, idFactory),
    ...(endedSession
      ? [createExecutionSignal(endedSession, "work_ended", timestamp, { outcome: "skipped", reason: "task_switch" }, idFactory)]
      : []),
  ];

  return {
    ...next,
    focusSessions: [focusSession, ...next.focusSessions],
    workSessions: [
      workSession,
      ...next.workSessions.map((session) => (endedSession && session.id === endedSession.id ? endedSession : session)),
    ],
    executionSignals: [...signals, ...next.executionSignals],
    tasks: next.tasks.map((item) => (item.id === taskId ? { ...item, status: "in_progress" as const, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
};

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

export const finishWorkSessionInState = (
  state: AppState,
  timestamp: string,
  taskId?: string,
  workSessionId?: string,
  options: { outcome?: SessionOutcome; source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  const outcome = options.outcome ?? "completed";
  const nextSession: WorkSession = { ...session, status: "ended", pausedAt: undefined, endedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => (item.id === session.id ? nextSession : item)),
    focusSessions: state.focusSessions.map((item) =>
      item.id === session.focusSessionId ? { ...item, endedAt: timestamp, outcome } : item,
    ),
    tasks: state.tasks.map((task: Task) =>
      task.id === session.taskId
        ? {
            ...task,
            status: task.status === "pending_review" ? task.status : ("in_progress" as const),
            actualPomodoros: outcome === "completed" ? (task.actualPomodoros ?? 0) + 1 : task.actualPomodoros,
            updatedAt: timestamp,
          }
        : task,
    ),
    executionSignals: [
      createExecutionSignal(
        nextSession,
        "work_ended",
        timestamp,
        { outcome, ...(options.source ? { source: options.source } : {}) },
        options.idFactory,
      ),
      ...state.executionSignals,
    ],
    updatedAt: timestamp,
  };
};
