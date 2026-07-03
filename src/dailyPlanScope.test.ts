import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import type { DailyPlan } from "./types";

const timestamp = "2026-07-04T08:00:00.000Z";

const plan = (ownerAccountId: string, committedTaskIds: string[]): DailyPlan => ({
  id: `plan_${ownerAccountId}_${todayKey()}`,
  workspaceId: "workspace_team",
  ownerAccountId,
  date: todayKey(),
  capacityPomodoros: 8,
  committedTaskIds,
  completedPomodoros: 0,
  suggestedTaskIds: [],
  reflection: "",
  review: {
    mood: "normal",
    wins: "",
    blockers: "",
    interruptionPattern: "",
    tomorrowFocus: "",
  },
  createdAt: timestamp,
  updatedAt: timestamp,
});

describe("daily plan account scope", () => {
  it("selects the current account daily plan when multiple members have plans for the same day", () => {
    const state = {
      ...createInitialState(),
      auth: {
        ...createInitialState().auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangyuqiao",
          workspaceId: "workspace_team",
          name: "王昱桥",
          email: "wangyuqiao",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      dailyPlans: [
        plan("account_hushengjie", ["task_hushengjie_today"]),
        plan("account_wangyuqiao", ["task_wangyuqiao_today"]),
      ],
    };

    expect(getTodayPlan(state).committedTaskIds).toEqual(["task_wangyuqiao_today"]);
  });

  it("creates a current account scoped daily plan instead of reusing another member's plan", () => {
    const state = {
      ...createInitialState(),
      auth: {
        ...createInitialState().auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangyuqiao",
          workspaceId: "workspace_team",
          name: "王昱桥",
          email: "wangyuqiao",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      dailyPlans: [plan("account_hushengjie", ["task_hushengjie_today"])],
    };

    expect(getTodayPlan(state)).toMatchObject({
      id: `plan_account_wangyuqiao_${todayKey()}`,
      ownerAccountId: "account_wangyuqiao",
      committedTaskIds: [],
    });
  });
});
