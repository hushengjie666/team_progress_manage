import { completedFocusSessions, defaultReview, deriveRewardState, pauseTimer, resumeTimer, suggestedTasks } from "./domain";
import { todayKey, uid } from "./seed";
import type { AppState, DailyPlan, ExecutionSignalType, FocusSession, Priority, RepeatRule, SessionMode, SessionOutcome, Severity, Subtask, Task, WorkSession } from "./types";

export type Tab = "workspace" | "focus" | "calendar" | "reports" | "settings";

export type TaskDraft = {
  title: string;
  project: string;
  tags: string;
  estimatePomodoros: number;
  priority: Priority;
  severity: Severity;
  notes: string;
  dueAt: string;
  reminderAt: string;
  repeatRule: RepeatRule;
  repeatIntervalDays: number;
};

export type TaskSort = "manual" | "dueAt" | "priority" | "estimate";

export type TaskFilters = {
  query: string;
  project: string;
  tag: string;
  priority: "all" | Priority;
  sort: TaskSort;
};

export const initialDraft: TaskDraft = {
  title: "",
  project: "TimeManage",
  tags: "产品, 自律",
  estimatePomodoros: 2,
  priority: "medium",
  severity: "medium",
  notes: "",
  dueAt: "",
  reminderAt: "",
  repeatRule: "none",
  repeatIntervalDays: 1,
};

export type DeletedTaskSnapshot = {
  task: Task;
  committedPlanIds: string[];
  deletedAt: string;
};

export type SplitDraft = {
  task: Task;
  text: string;
};

export const nowIso = () => new Date().toISOString();
export const today = () => todayKey();
export const priorityWeight: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
export const initialFilters: TaskFilters = { query: "", project: "all", tag: "all", priority: "all", sort: "manual" };

export const emptyTaskDefaults = (timestamp: string, sortOrder: number) => ({
  subtasks: [] as Subtask[],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  repeatRule: "none" as RepeatRule,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const formatDateTimeLocal = (iso?: string) => {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
};

export const parseDateTimeLocal = (value: string) => (value ? new Date(value).toISOString() : undefined);

export const formatTime = (seconds: number) => {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60).toString().padStart(2, "0");
  const secs = Math.floor(safe % 60).toString().padStart(2, "0");
  return `${mins}:${secs}`;
};

export const labelPriority: Record<Priority, string> = {
  low: "低",
  medium: "中",
  high: "高",
  urgent: "紧急",
};

export const labelSeverity: Record<Severity, string> = {
  low: "低",
  medium: "中",
  high: "高",
  very_high: "非常高",
};

export const modeLabel: Record<SessionMode, string> = {
  focus: "专注番茄",
  short_break: "短休息",
  long_break: "长休息",
};

const createExecutionSignal = (
  workSession: WorkSession,
  type: ExecutionSignalType,
  timestamp: string,
  payload?: Record<string, unknown>,
) => ({
  id: uid("signal"),
  workSessionId: workSession.id,
  taskId: workSession.taskId,
  executorMemberId: workSession.executorMemberId,
  type,
  createdAt: timestamp,
  payload,
});

const activeWorkSession = (state: AppState) => {
  const active = state.activeTimer;
  if (!active || active.mode !== "focus") return undefined;
  return state.workSessions.find((session) =>
    active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId,
  );
};

const activeWorkSessionForExecutor = (state: AppState, executorMemberId?: string) =>
  state.workSessions.find((session) => session.status === "active" && session.executorMemberId === executorMemberId);

const endWorkSessionForSwitch = (state: AppState, workSession: WorkSession, timestamp: string, nextTaskId: string): AppState => {
  const active = state.activeTimer?.workSessionId === workSession.id || state.activeTimer?.sessionId === workSession.focusSessionId
    ? state.activeTimer
    : undefined;

  const endedWorkSession: WorkSession = {
    ...workSession,
    status: "ended",
    pausedAt: undefined,
    endedAt: timestamp,
    totalPausedSeconds: active?.totalPausedSeconds ?? workSession.totalPausedSeconds,
    updatedAt: timestamp,
  };
  return {
    ...state,
    focusSessions: state.focusSessions.map((session) =>
      session.id === workSession.focusSessionId
        ? {
            ...session,
            endedAt: timestamp,
            outcome: "skipped" as const,
          }
        : session,
    ),
    workSessions: state.workSessions.map((session) => (session.id === workSession.id ? endedWorkSession : session)),
    executionSignals: [
      createExecutionSignal(endedWorkSession, "work_ended", timestamp, { outcome: "skipped", reason: "task_switch", nextTaskId }),
      ...state.executionSignals,
    ],
    activeTimer: active ? undefined : state.activeTimer,
    updatedAt: timestamp,
  };
};

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
    plan.date === today() && isFocusCompleted
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

export const startTimerInState = (
  state: AppState,
  mode: SessionMode,
  taskId: string | undefined,
  timestamp: string,
  strictProfileId?: string,
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
    strictProfileId: mode === "focus" ? strictProfileId : undefined,
  };
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : undefined;
  const executorMemberId = task?.primaryExecutorMemberId ?? state.currentMemberId;
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
      strictProfileId,
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
  return {
    ...state,
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
      strictStarted: false,
    },
    tasks: taskId
      ? state.tasks.map((task) => (task.id === taskId ? { ...task, status: "in_progress" as const, updatedAt: timestamp } : task))
      : state.tasks,
    updatedAt: timestamp,
  };
};

export const getTodayPlan = (state: AppState): DailyPlan => {
  const existing = state.dailyPlans.find((plan) => plan.date === today());
  if (existing) return existing;
  return {
    id: `plan_${today()}`,
    date: today(),
    capacityPomodoros: Math.max(4, state.rewardState.dailyGoal),
    committedTaskIds: [],
    completedPomodoros: 0,
    suggestedTaskIds: suggestedTasks(state),
    reflection: "",
    review: defaultReview(),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
};

export const ensureTodayPlan = (state: AppState): AppState => {
  if (state.dailyPlans.some((plan) => plan.date === today())) return state;
  return { ...state, dailyPlans: [...state.dailyPlans, getTodayPlan(state)] };
};
