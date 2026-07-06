import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import {
  alignDailyPlanIdentity,
  currentAccountDailyPlanForDate,
  currentAccountDailyPlanForWorkspaceDate,
} from "./dailyPlanScope";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import type { DailyPlan } from "./types";

const timestamp = "2026-07-04T08:00:00.000Z";

const plan = (ownerAccountId: string, committedTaskIds: string[], workspaceId = "workspace_team"): DailyPlan => ({
  id: `plan_${ownerAccountId}_${workspaceId}_${todayKey()}`,
  workspaceId,
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
      id: `plan_account_wangyuqiao_workspace_team_${todayKey()}`,
      workspaceId: "workspace_team",
      ownerAccountId: "account_wangyuqiao",
      committedTaskIds: [],
    });
  });

  it("prefers the account scoped daily plan when another plan has the same owner and date", () => {
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
        {
          ...plan("account_wangyuqiao", ["task_shared_id"]),
          id: `plan_account_wangyuqiao_${todayKey()}`,
        },
        plan("account_wangyuqiao", ["task_account_id"]),
      ],
    };

    expect(currentAccountDailyPlanForDate(state, todayKey())?.committedTaskIds).toEqual(["task_account_id"]);
  });

  it("aligns daily plan ids to the owner and date", () => {
    expect(alignDailyPlanIdentity({
      ...plan("account_wangyuqiao", ["task_today"]),
      id: `plan_account_wangyuqiao_${todayKey()}`,
    })).toMatchObject({
      id: `plan_account_wangyuqiao_workspace_team_${todayKey()}`,
      ownerAccountId: "account_wangyuqiao",
      workspaceId: "workspace_team",
    });
  });

  it("keeps current account plans separate by workspace while getTodayPlan returns the combined view", () => {
    const state = {
      ...createInitialState(),
      auth: {
        ...createInitialState().auth,
        status: "authenticated" as const,
        account: {
          id: "account_wangyuqiao",
          workspaceId: "workspace_private",
          name: "王昱桥",
          email: "wangyuqiao",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
        workspace: {
          id: "workspace_private",
          name: "私人区",
          type: "private" as const,
          ownerAccountId: "account_wangyuqiao",
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      dailyPlans: [
        plan("account_wangyuqiao", ["task_private_today"], "workspace_private"),
        plan("account_wangyuqiao", ["task_team_today"], "workspace_team"),
      ],
    };

    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_private", todayKey())?.committedTaskIds).toEqual(["task_private_today"]);
    expect(currentAccountDailyPlanForWorkspaceDate(state, "workspace_team", todayKey())?.committedTaskIds).toEqual(["task_team_today"]);
    expect(getTodayPlan(state).committedTaskIds).toEqual(["task_private_today", "task_team_today"]);
    expect(currentAccountDailyPlanForDate(state, todayKey())?.committedTaskIds).toEqual(["task_private_today"]);
  });
});
