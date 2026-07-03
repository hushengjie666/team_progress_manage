import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import { mergeRowsIntoState, type SyncRow } from "./sync";
import { createInitialState } from "./test/fixtures";

describe("data sync merge", () => {
  it("keeps newer local daily plan committed tasks when remote sync is older", () => {
    const state = createInitialState();
    const localPlan = {
      ...getTodayPlan(state),
      id: "plan_sync_today",
      date: "2026-05-10",
      committedTaskIds: [],
      updatedAt: "2026-05-10T12:00:00.000Z",
    };
    const remotePlan = {
      ...localPlan,
      committedTaskIds: ["task_write_prd"],
      updatedAt: "2026-05-10T09:00:00.000Z",
    };
    const row: SyncRow = {
      entity: "daily_plan",
      id: localPlan.id,
      device_id: "other_browser",
      updated_at: remotePlan.updatedAt,
      payload: remotePlan,
      revision: 12,
      version: 1,
    };

    const merged = mergeRowsIntoState({ ...state, dailyPlans: [localPlan] }, [row], 12);

    expect(merged.dailyPlans[0].committedTaskIds).toEqual([]);
  });

  it("uses the row account id as the daily plan owner when loading team state", () => {
    const state = createInitialState();
    const remotePlan = {
      id: "plan_2026-07-04",
      workspaceId: "workspace_team",
      date: "2026-07-04",
      capacityPomodoros: 8,
      committedTaskIds: ["task_remote_today"],
      completedPomodoros: 0,
      suggestedTaskIds: [],
      reflection: "",
      review: {
        mood: "normal" as const,
        wins: "",
        blockers: "",
        interruptionPattern: "",
        tomorrowFocus: "",
      },
      createdAt: "2026-07-04T08:00:00.000Z",
      updatedAt: "2026-07-04T09:00:00.000Z",
    };
    const row: SyncRow = {
      workspace_id: "workspace_team",
      account_id: "account_hushengjie",
      entity: "daily_plan",
      id: remotePlan.id,
      device_id: "other_browser",
      updated_at: remotePlan.updatedAt,
      payload: remotePlan,
      revision: 13,
      version: 1,
    };

    const merged = mergeRowsIntoState({ ...state, dailyPlans: [] }, [row], 13, { forceRemote: true });

    expect(merged.dailyPlans[0]).toMatchObject({
      id: "plan_account_hushengjie_2026-07-04",
      workspaceId: "workspace_team",
      ownerAccountId: "account_hushengjie",
      committedTaskIds: ["task_remote_today"],
    });
  });

  it("merges account daily plan rows by owner and date when the incoming row uses a shared date id", () => {
    const state = createInitialState();
    const localPlan = {
      ...getTodayPlan(state),
      id: "plan_account_hushengjie_2026-07-04",
      workspaceId: "workspace_team",
      ownerAccountId: "account_hushengjie",
      date: "2026-07-04",
      committedTaskIds: ["task_local_today"],
      updatedAt: "2026-07-04T08:00:00.000Z",
    };
    const remotePlan = {
      ...localPlan,
      id: "plan_2026-07-04",
      committedTaskIds: ["task_remote_today"],
      updatedAt: "2026-07-04T09:00:00.000Z",
    };
    const row: SyncRow = {
      workspace_id: "workspace_team",
      account_id: "account_hushengjie",
      entity: "daily_plan",
      id: remotePlan.id,
      device_id: "other_browser",
      updated_at: remotePlan.updatedAt,
      payload: remotePlan,
      revision: 14,
      version: 1,
    };

    const merged = mergeRowsIntoState({ ...state, dailyPlans: [localPlan] }, [row], 14, { forceRemote: true });

    expect(merged.dailyPlans).toHaveLength(1);
    expect(merged.dailyPlans[0]).toMatchObject({
      id: "plan_account_hushengjie_2026-07-04",
      ownerAccountId: "account_hushengjie",
      committedTaskIds: ["task_remote_today"],
    });
  });
});
