import { resolveMemberIdForProject } from "./memberIdentity";
import { uid } from "./seed";
import type { AppState, WorkSession } from "./types";
import { createExecutionSignal } from "./workSessionTransitions";
import { claimTodayPlanTasksForCurrentMemberInState, ensurePlanInState } from "./workSessionTodayPlan";
import { nowIso, today } from "./appClock";
import { currentAccountDailyPlansForDate, dailyPlanBelongsToCurrentAccount, workspaceIdForTask } from "./dailyPlanScope";
import { endActiveWorkSessionsForTaskInState } from "./appTimerWorkSession";

export const removeTaskFromTodayInState = (state: AppState, taskId: string, timestamp: string): AppState => {
  const endedState = endActiveWorkSessionsForTaskInState(state, taskId, timestamp);
  return {
    ...endedState,
    dailyPlans: endedState.dailyPlans.map((item) =>
      item.date === today() && dailyPlanBelongsToCurrentAccount(endedState, item) && item.committedTaskIds.includes(taskId)
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

const claimCurrentAccountTodayPlans = (state: AppState, date: string, timestamp: string) =>
  currentAccountDailyPlansForDate(state, date).reduce(
    (current, plan) => claimTodayPlanTasksForCurrentMemberInState(current, plan, timestamp),
    state,
  );

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
  let withActiveTasks = normalizedState;
  for (const taskId of activeTaskIds) {
    const task = withActiveTasks.tasks.find((item) => item.id === taskId);
    const { state: withPlan, plan } = ensurePlanInState(withActiveTasks, todayDate, timestamp, task ? workspaceIdForTask(withActiveTasks, task) : undefined);
    withActiveTasks = plan.committedTaskIds.includes(taskId)
      ? withPlan
      : {
          ...withPlan,
          dailyPlans: withPlan.dailyPlans.map((item) =>
            item.id === plan.id
              ? {
                  ...item,
                  committedTaskIds: Array.from(new Set([...item.committedTaskIds, taskId])),
                  updatedAt: timestamp,
                }
              : item,
          ),
          updatedAt: timestamp,
        };
  }
  if (currentAccountDailyPlansForDate(withActiveTasks, todayDate).length === 0) {
    withActiveTasks = ensurePlanInState(withActiveTasks, todayDate, timestamp).state;
  }
  return claimCurrentAccountTodayPlans(withActiveTasks, todayDate, timestamp);
};
