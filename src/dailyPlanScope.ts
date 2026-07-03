import type { AppState, DailyPlan } from "./types";

export const currentDailyPlanOwnerAccountId = (state: AppState) => state.auth.account?.id;

export const dailyPlanIdForOwnerAndDate = (ownerAccountId: string | undefined, date: string) =>
  ownerAccountId ? `plan_${ownerAccountId}_${date}` : `plan_${date}`;

export const dailyPlanIdForDate = (state: AppState, date: string) =>
  dailyPlanIdForOwnerAndDate(currentDailyPlanOwnerAccountId(state), date);

export const alignDailyPlanIdentity = (plan: DailyPlan): DailyPlan => {
  const id = dailyPlanIdForOwnerAndDate(plan.ownerAccountId, plan.date);
  return plan.id === id ? plan : { ...plan, id };
};

export const dailyPlanIdentityKey = (plan: DailyPlan) =>
  `${plan.ownerAccountId ?? ""}:${plan.date}`;

export const dailyPlanBelongsToCurrentAccount = (state: AppState, plan: DailyPlan) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? plan.ownerAccountId === ownerAccountId : !plan.ownerAccountId;
};

export const dailyPlansForCurrentAccount = (state: AppState) =>
  state.dailyPlans.filter((plan) => dailyPlanBelongsToCurrentAccount(state, plan));

export const currentAccountDailyPlanForDate = (state: AppState, date: string) => {
  const candidates = state.dailyPlans.filter((plan) => plan.date === date && dailyPlanBelongsToCurrentAccount(state, plan));
  return candidates.find((plan) => plan.id === dailyPlanIdForDate(state, date)) ?? candidates[0];
};
