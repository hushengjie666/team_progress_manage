import { defaultReview, suggestedTasks } from "./domain";
import type { AppState, DailyPlan } from "./types";
import { nowIso, today } from "./appClock";
import {
  combinedCurrentAccountDailyPlanForDate,
  currentAccountDailyPlanForDate,
  currentDailyPlanOwnerAccountId,
  currentDailyPlanWorkspaceId,
  dailyPlanIdForDate,
} from "./dailyPlanScope";

export const createDailyPlanForDate = (
  state: AppState,
  date: string,
  timestamp = nowIso(),
  workspaceId = currentDailyPlanWorkspaceId(state),
): DailyPlan => ({
  id: dailyPlanIdForDate(state, date, workspaceId),
  workspaceId,
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
  const existing = combinedCurrentAccountDailyPlanForDate(state, todayDate) ?? currentAccountDailyPlanForDate(state, todayDate);
  if (existing) return existing;
  return createDailyPlanForDate(state, todayDate);
};
