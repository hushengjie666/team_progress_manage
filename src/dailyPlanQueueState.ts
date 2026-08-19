import { createDailyPlanForDate } from "./appTodayPlan";
import { currentAccountDailyPlanForWorkspaceDate } from "./dailyPlanScope";
import type { AppState, Task } from "./types";

export type TaskQueueCommitSnapshot = {
  planWasPresent: boolean;
  taskStatus: Task["status"];
  taskUpdatedAt: string;
};

export const taskQueueCommitSnapshot = (
  state: AppState,
  taskId: string,
  workspaceId: string | undefined,
  date: string,
): TaskQueueCommitSnapshot | undefined => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) return undefined;
  return {
    planWasPresent: Boolean(currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date)),
    taskStatus: task.status,
    taskUpdatedAt: task.updatedAt,
  };
};

export const addTaskToDailyPlanInState = (
  state: AppState,
  taskId: string,
  workspaceId: string | undefined,
  date: string,
  timestamp: string,
): AppState => {
  const existingPlan = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existingPlan ?? createDailyPlanForDate(state, date, timestamp, workspaceId);
  const committedTaskIds = plan.committedTaskIds.includes(taskId)
    ? plan.committedTaskIds
    : [...plan.committedTaskIds, taskId];
  const nextPlan = { ...plan, committedTaskIds, updatedAt: timestamp };
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.status === "pool"
        ? { ...task, status: "committed", updatedAt: timestamp }
        : task,
    ),
    dailyPlans: existingPlan
      ? state.dailyPlans.map((item) => item.id === existingPlan.id ? nextPlan : item)
      : [...state.dailyPlans, nextPlan],
    updatedAt: timestamp,
  };
};

export const rollbackTaskQueueCommitInState = (
  state: AppState,
  taskId: string,
  workspaceId: string | undefined,
  date: string,
  snapshot: TaskQueueCommitSnapshot,
): AppState => {
  const plan = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const committedTaskIds = plan?.committedTaskIds.filter((id) => id !== taskId) ?? [];
  const removeCreatedPlan = Boolean(plan && !snapshot.planWasPresent && committedTaskIds.length === 0);
  return {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId && task.status === "committed"
        ? { ...task, status: snapshot.taskStatus, updatedAt: snapshot.taskUpdatedAt }
        : task,
    ),
    dailyPlans: state.dailyPlans
      .filter((item) => !removeCreatedPlan || item.id !== plan?.id)
      .map((item) => item.id === plan?.id ? { ...item, committedTaskIds } : item),
  };
};
