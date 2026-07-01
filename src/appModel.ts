import { calculateRemaining, completedFocusSessions, defaultReview, deriveRewardState, nextBreakMode, pauseTimer, restoreTimer, resumeTimer, suggestedTasks } from "./domain";
import { resolveCurrentMember, resolveMemberIdForProject } from "./memberIdentity";
import { todayKey, uid } from "./seed";
import type { AppState, DailyPlan, FocusSession, Priority, RepeatRule, SessionMode, SessionOutcome, Severity, Subtask, Task, TaskStage, WorkSession } from "./types";
import {
  activeWorkSessionForExecutor,
  claimTaskForCurrentMemberIfUnassigned,
  createExecutionSignal,
  endActiveWorkSessionsForTaskInState as endWorkSessionsForTaskInState,
  endWorkSessionForSwitchInState,
} from "./workSessionTransitions";

export type Tab = "workspace" | "project" | "member_status" | "focus" | "calendar" | "daily" | "reports" | "settings";

export type TaskDraft = {
  title: string;
  project: string;
  tags: string;
  estimatePomodoros: number;
  priority: Priority;
  severity: Severity;
  stage: TaskStage;
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
  stage: "requirements",
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
export const taskStageOptions: { value: TaskStage; label: string }[] = [
  { value: "sales", label: "销售" },
  { value: "requirements", label: "需求" },
  { value: "design", label: "设计" },
  { value: "development", label: "开发" },
  { value: "testing", label: "测试" },
  { value: "deployment", label: "部署" },
  { value: "acceptance", label: "验收" },
];
export const labelTaskStage: Record<TaskStage, string> = Object.fromEntries(taskStageOptions.map((option) => [option.value, option.label])) as Record<TaskStage, string>;
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

const activeWorkSession = (state: AppState) => {
  const active = state.activeTimer;
  if (!active || active.mode !== "focus") return undefined;
  return state.workSessions.find((session) =>
    active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId,
  );
};

const endWorkSessionForSwitch = (state: AppState, workSession: WorkSession, timestamp: string, nextTaskId: string): AppState => {
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

export const removeTaskFromTodayInState = (state: AppState, taskId: string, timestamp: string): AppState => {
  const plan = getTodayPlan(state);
  const endedState = endActiveWorkSessionsForTaskInState(state, taskId, timestamp);
  return {
    ...endedState,
    dailyPlans: endedState.dailyPlans.map((item) =>
      item.id === plan.id
        ? {
            ...item,
            committedTaskIds: item.committedTaskIds.filter((id) => id !== taskId),
            updatedAt: timestamp,
          }
        : item,
    ),
    tasks: endedState.tasks.map((task) =>
      task.id === taskId && task.status === "committed"
        ? { ...task, status: "pool", updatedAt: timestamp }
        : task,
    ),
    updatedAt: timestamp,
  };
};

export const shouldFinishExpiredTimerInState = (state: AppState, timestamp = nowIso()) => {
  const active = state.activeTimer;
  return Boolean(active?.pendingSettlement === "pending" || (active?.isRunning && calculateRemaining(active, new Date(timestamp)) <= 0));
};

export const finishExpiredTimerInState = (state: AppState, timestamp = nowIso()): AppState => {
  const active = state.activeTimer;
  if (!active) return state;
  const ended = endSessionInState(state, "completed", timestamp);
  if (active.mode === "focus" && state.settings.autoStartBreaks) {
    return startTimerInState(ended, nextBreakMode(ended), undefined, timestamp);
  }
  if (active.mode !== "focus" && state.settings.autoStartFocus) {
    const nextTask = ended.tasks.find((task) => task.status === "committed" || task.status === "in_progress");
    return startTimerInState(ended, "focus", nextTask?.id, timestamp, ended.settings.activeBlockProfileId);
  }
  return ended;
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
      strictStarted: false,
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
  const todayDate = today();
  const timestamp = nowIso();
  const activeTimer = state.activeTimer;
  const activeTimerTask = activeTimer?.mode === "focus" && activeTimer.taskId
    ? state.tasks.find((task) => task.id === activeTimer.taskId)
    : undefined;
  const hasActiveTimerWorkSession = Boolean(
    activeTimer &&
      state.workSessions.some((session) =>
        activeTimer.workSessionId ? session.id === activeTimer.workSessionId : session.focusSessionId === activeTimer.sessionId,
      ),
  );
  const repairedState =
    activeTimer && activeTimerTask && !hasActiveTimerWorkSession
      ? (() => {
          const workSession: WorkSession = {
            id: activeTimer.workSessionId ?? uid("work_session"),
            taskId: activeTimerTask.id,
            executorMemberId: activeTimerTask.primaryExecutorMemberId ?? resolveMemberIdForProject(state, activeTimerTask.projectId),
            focusSessionId: activeTimer.sessionId,
            status: activeTimer.isRunning ? "active" : "paused",
            startedAt: activeTimer.startedAt,
            pausedAt: activeTimer.pausedAt,
            totalPausedSeconds: activeTimer.totalPausedSeconds,
            createdAt: activeTimer.startedAt,
            updatedAt: timestamp,
          };
          return {
            ...state,
            workSessions: [workSession, ...state.workSessions],
            executionSignals: [createExecutionSignal(workSession, "work_started", timestamp, { source: "active_timer_repair" }), ...state.executionSignals],
            activeTimer: { ...activeTimer, workSessionId: workSession.id },
            updatedAt: timestamp,
          };
        })()
      : state;
  const staleActiveTaskIds = repairedState.workSessions
    .filter((session) => (session.status === "active" || session.status === "paused") && session.startedAt.slice(0, 10) !== todayDate)
    .map((session) => session.taskId);
  const normalizedState = staleActiveTaskIds.reduce(
    (current, taskId) => endActiveWorkSessionsForTaskInState(current, taskId, timestamp, "stale_active_session"),
    repairedState,
  );
  const activeTaskIds = normalizedState.workSessions
    .filter((session) => session.status === "active" || session.status === "paused")
    .map((session) => session.taskId)
    .filter((taskId) =>
      normalizedState.tasks.some(
        (task) => task.id === taskId && task.status !== "completed" && task.status !== "split" && task.status !== "archived",
      ),
    );
  const existing = normalizedState.dailyPlans.find((plan) => plan.date === todayDate);
  if (!existing) {
    const plan = getTodayPlan(normalizedState);
    return {
      ...normalizedState,
      dailyPlans: [
        ...normalizedState.dailyPlans,
        {
          ...plan,
          committedTaskIds: Array.from(new Set([...plan.committedTaskIds, ...activeTaskIds])),
        },
      ],
    };
  }
  const missingActiveTaskIds = activeTaskIds.filter((taskId) => !existing.committedTaskIds.includes(taskId));
  if (missingActiveTaskIds.length === 0) return normalizedState;
  return {
    ...normalizedState,
    dailyPlans: normalizedState.dailyPlans.map((plan) =>
      plan.id === existing.id
        ? {
            ...plan,
            committedTaskIds: Array.from(new Set([...plan.committedTaskIds, ...missingActiveTaskIds])),
            updatedAt: timestamp,
          }
        : plan,
    ),
    updatedAt: timestamp,
  };
};
