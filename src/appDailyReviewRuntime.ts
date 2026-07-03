import {
  defaultReview,
  deriveRewardState,
  suggestedCapacity,
  suggestedTasks,
} from "./domain";
import { getTodayPlan, nowIso } from "./appModel";
import type { AppState, DailyPlan } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

export type AppDailyReviewRuntimeOptions = {
  updateState: UpdateState;
  setToast: (message: string) => void;
};

export type AppDailyReviewRuntime = {
  updateReview: (patch: Partial<DailyPlan["review"]>) => void;
  completeReview: () => void;
};

export function createAppDailyReviewRuntime({
  updateState,
  setToast,
}: AppDailyReviewRuntimeOptions): AppDailyReviewRuntime {
  const updateReview = (patch: Partial<DailyPlan["review"]>) => {
    updateState((value) => {
      const timestamp = nowIso();
      const plan = getTodayPlan(value);
      const review = { ...defaultReview(), ...plan.review, ...patch };
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id ? { ...item, review, reflection: review.wins || item.reflection, updatedAt: timestamp } : item,
        ),
        updatedAt: timestamp,
      };
    });
  };

  const completeReview = () => {
    const timestamp = nowIso();
    updateState((value) => {
      const plan = getTodayPlan(value);
      const nextPlan = {
        ...plan,
        reviewedAt: timestamp,
        suggestedCapacityPomodoros: suggestedCapacity(value),
        suggestedTaskIds: suggestedTasks(value),
        updatedAt: timestamp,
      };
      const nextState = {
        ...value,
        dailyPlans: value.dailyPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
        updatedAt: timestamp,
      };
      return {
        ...nextState,
        rewardState: deriveRewardState(nextState, timestamp),
      };
    });
    setToast("日终回顾已完成，明日容量建议已更新");
  };

  return {
    updateReview,
    completeReview,
  };
}
