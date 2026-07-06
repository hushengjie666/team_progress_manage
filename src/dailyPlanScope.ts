import type { AppState, DailyPlan, Task } from "./types";

export const currentDailyPlanOwnerAccountId = (state: AppState) => state.auth.account?.id;
export const currentDailyPlanWorkspaceId = (state: AppState) => state.auth.workspace?.id ?? state.auth.account?.workspaceId;

export const workspaceIdForTask = (state: AppState, task: Task) => {
  const project = state.projects.find((item) => item.id === task.projectId);
  return project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
};

export const dailyPlanIdForOwnerWorkspaceAndDate = (
  ownerAccountId: string | undefined,
  workspaceId: string | undefined,
  date: string,
) => {
  const ownerPart = ownerAccountId ?? "local";
  return workspaceId ? `plan_${ownerPart}_${workspaceId}_${date}` : `plan_${ownerPart}_${date}`;
};

export const dailyPlanIdForOwnerAndDate = (ownerAccountId: string | undefined, date: string) =>
  dailyPlanIdForOwnerWorkspaceAndDate(ownerAccountId, undefined, date);

export const dailyPlanIdForDate = (state: AppState, date: string, workspaceId = currentDailyPlanWorkspaceId(state)) =>
  dailyPlanIdForOwnerWorkspaceAndDate(currentDailyPlanOwnerAccountId(state), workspaceId, date);

export const alignDailyPlanIdentity = (plan: DailyPlan): DailyPlan => {
  const id = dailyPlanIdForOwnerWorkspaceAndDate(plan.ownerAccountId, plan.workspaceId, plan.date);
  return plan.id === id ? plan : { ...plan, id };
};

export const dailyPlanIdentityKey = (plan: DailyPlan) =>
  `${plan.ownerAccountId ?? ""}:${plan.workspaceId ?? ""}:${plan.date}`;

export const dailyPlanBelongsToCurrentAccount = (state: AppState, plan: DailyPlan) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? plan.ownerAccountId === ownerAccountId : !plan.ownerAccountId;
};

export const dailyPlansForCurrentAccount = (state: AppState) =>
  state.dailyPlans.filter((plan) => dailyPlanBelongsToCurrentAccount(state, plan));

export const dailyPlanBelongsToWorkspace = (plan: DailyPlan, workspaceId: string | undefined) =>
  workspaceId ? plan.workspaceId === workspaceId : !plan.workspaceId;

export const currentAccountDailyPlansForDate = (state: AppState, date: string) =>
  dailyPlansForCurrentAccount(state).filter((plan) => plan.date === date);

export const currentAccountDailyPlanForWorkspaceDate = (
  state: AppState,
  workspaceId: string | undefined,
  date: string,
) => {
  const candidates = currentAccountDailyPlansForDate(state, date).filter((plan) => dailyPlanBelongsToWorkspace(plan, workspaceId));
  return candidates.find((plan) => plan.id === dailyPlanIdForDate(state, date, workspaceId)) ?? candidates[0];
};

export const currentAccountDailyPlanForTaskDate = (state: AppState, task: Task, date: string) =>
  currentAccountDailyPlanForWorkspaceDate(state, workspaceIdForTask(state, task), date);

export const combinedCurrentAccountDailyPlanForDate = (state: AppState, date: string) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  if (plans.length <= 1) return plans[0];
  const first = plans[0];
  return {
    ...first,
    id: dailyPlanIdForOwnerAndDate(currentDailyPlanOwnerAccountId(state), date),
    workspaceId: undefined,
    capacityPomodoros: plans.reduce((sum, plan) => sum + plan.capacityPomodoros, 0),
    committedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.committedTaskIds))),
    completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0),
    suggestedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.suggestedTaskIds))),
    updatedAt: plans.reduce((latest, plan) => (plan.updatedAt > latest ? plan.updatedAt : latest), first.updatedAt),
  };
};

export const currentAccountDailyPlanForDate = (state: AppState, date: string) => {
  const workspacePlan = currentAccountDailyPlanForWorkspaceDate(state, currentDailyPlanWorkspaceId(state), date);
  return workspacePlan ?? combinedCurrentAccountDailyPlanForDate(state, date);
};
