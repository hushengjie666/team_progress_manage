import { todayKey } from "./seed";
import type { AppState, BadgeRule, RewardState } from "./types";
import {
  completedFocusSessions,
  interruptionsOnDate,
  planForDate,
} from "./domainQueries";

const dayBefore = (date: Date, offset: number) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - offset);
  return todayKey(copy);
};

export const badgeRules = (state: AppState): BadgeRule[] => {
  const completed = completedFocusSessions(state).length;
  const lowInterruptionDay = state.dailyPlans.some((plan) => plan.completedPomodoros >= state.rewardState.dailyGoal && interruptionsOnDate(state, plan.date).length <= 1);
  const accurateEstimate = state.tasks.some((task) =>
    task.estimateHistory.some((entry) => Math.abs(entry.actualPomodoros - entry.estimatedPomodoros) <= 1),
  );
  const streak = computeStreak(state);
  return [
    { id: "first_focus", label: "首个番茄", earned: completed > 0 },
    { id: "streak_3", label: "连续 3 天", earned: streak >= 3 },
    { id: "streak_7", label: "连续 7 天", earned: streak >= 7 },
    { id: "streak_14", label: "连续 14 天", earned: streak >= 14 },
    { id: "low_interruption", label: "低中断日", earned: lowInterruptionDay },
    { id: "accurate_estimate", label: "估算准确日", earned: accurateEstimate },
  ];
};

export const computeStreak = (state: AppState, now = new Date()) => {
  let streak = 0;
  for (let offset = 0; offset < 365; offset += 1) {
    const date = dayBefore(now, offset);
    const plan = planForDate(state, date);
    if (!plan || plan.completedPomodoros < state.rewardState.dailyGoal) {
      if (offset === 0) continue;
      break;
    }
    streak += 1;
  }
  return streak;
};

export const deriveRewardState = (state: AppState, timestamp = new Date().toISOString()): RewardState => {
  const badges = new Set(state.rewardState.badges);
  for (const rule of badgeRules(state)) {
    if (rule.earned) badges.add(rule.label);
  }
  return {
    ...state.rewardState,
    streak: computeStreak(state),
    badges: Array.from(badges),
    focusGarden: completedFocusSessions(state).length,
    visualProgress: Math.min(100, completedFocusSessions(state).length * 12),
    lastRewardedAt: timestamp,
  };
};
