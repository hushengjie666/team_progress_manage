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
});
