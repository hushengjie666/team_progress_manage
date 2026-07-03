import { defaultReview, suggestedTasks } from "./domain";
import type { AppState, DailyPlan } from "./types";
import { nowIso, today } from "./appClock";

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
