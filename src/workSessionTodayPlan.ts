import { defaultReview } from "./domain";
import { resolveMemberIdForProject } from "./memberIdentity";
import { todayKey } from "./seed";
import type { AppState, DailyPlan, Task } from "./types";

export const ensurePlanInState = (state: AppState, date: string, timestamp: string): { state: AppState; plan: DailyPlan } => {
  const existing = state.dailyPlans.find((plan) => plan.date === date);
  if (existing) return { state, plan: existing };

  const plan: DailyPlan = {
    id: `plan_${date}`,
    workspaceId: state.auth.workspace?.id,
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
