import { createInitialState } from "./seed";
import type { AppState } from "./types";
import { demoDateKey } from "./demoDataBuilders";
import { createDemoDailyPlans } from "./demoDataPlanFixtures";
import { createDemoFocusSessions } from "./demoDataFocusFixtures";
import { createDemoInterruptions } from "./demoDataInterruptionFixtures";
import { createDemoTasks } from "./demoDataTaskFixtures";

export const createDemoState = (): AppState => {
  const base = createInitialState();
  const now = new Date().toISOString();
  const today = demoDateKey(0);

  return {
    ...base,
    tasks: createDemoTasks(now),
    dailyPlans: createDemoDailyPlans(now, today),
    focusSessions: createDemoFocusSessions(),
    workSessions: [],
    executionSignals: [],
    interruptions: createDemoInterruptions(),
    rewardState: {
      streak: 11,
      dailyGoal: 5,
      badges: ["首个承诺", "连续 3 天", "连续 7 天", "估算校准"],
      focusGarden: 56,
      visualProgress: 84,
      lastRewardedAt: now,
    },
    updatedAt: now,
  };
};
