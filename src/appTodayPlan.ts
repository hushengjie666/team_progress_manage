import { defaultReview, suggestedTasks } from "./domain";
import type { AppState, DailyPlan } from "./types";
import { nowIso, today } from "./appClock";
import {
  currentAccountDailyPlanForDate,
  currentDailyPlanOwnerAccountId,
  dailyPlanIdForDate,
} from "./dailyPlanScope";

export const createDailyPlanForDate = (state: AppState, date: string, timestamp = nowIso()): DailyPlan => ({
  id: dailyPlanIdForDate(state, date),
  workspaceId: state.auth.workspace?.id,
  ownerAccountId: currentDailyPlanOwnerAccountId(state),
  date,
  capacityPomodoros: Math.max(4, state.rewardState.dailyGoal),
  committedTaskIds: [],
  completedPomodoros: 0,
  suggestedTaskIds: date === today() ? suggestedTasks(state) : [],
  reflection: "",
  review: defaultReview(),
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const getTodayPlan = (state: AppState): DailyPlan => {
  const todayDate = today();
  const existing = currentAccountDailyPlanForDate(state, todayDate);
  if (existing) return existing;
  return createDailyPlanForDate(state, todayDate);
};
