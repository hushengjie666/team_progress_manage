import type { AppState, DailyPlan } from "./types";

export const currentDailyPlanOwnerAccountId = (state: AppState) => state.auth.account?.id;

export const dailyPlanIdForDate = (state: AppState, date: string) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? `plan_${ownerAccountId}_${date}` : `plan_${date}`;
};

export const dailyPlanBelongsToCurrentAccount = (state: AppState, plan: DailyPlan) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? plan.ownerAccountId === ownerAccountId : !plan.ownerAccountId;
};

export const dailyPlansForCurrentAccount = (state: AppState) =>
  state.dailyPlans.filter((plan) => dailyPlanBelongsToCurrentAccount(state, plan));

export const currentAccountDailyPlanForDate = (state: AppState, date: string) =>
  state.dailyPlans.find((plan) => plan.date === date && dailyPlanBelongsToCurrentAccount(state, plan));
