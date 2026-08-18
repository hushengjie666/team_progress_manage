import { describe, expect, it, vi } from "vitest";
import { createDailyPlanForDate } from "./appTodayPlan";
import { ensureRemoteDailyPlan } from "./remoteDailyPlan";
import { createTestState } from "./test/fixtures";

describe("remote daily plan creation", () => {
  it("creates a missing plan once and uses the server-confirmed row", async () => {
    const source = createTestState({ dailyPlans: [] });
    const serverPlan = createDailyPlanForDate(source, "2026-08-18", "2026-08-18T08:00:00.000Z");
    const saved = { ...source, dailyPlans: [serverPlan] };
    const runTeamCommand = vi.fn(async (command) => {
      expect(command.kind).toBe("create");
      expect(command.entity).toBe("daily_plan");
      expect(command.idempotencyKey).toBe(`daily-plan:create:${serverPlan.id}`);
      return saved;
    });

    const result = await ensureRemoteDailyPlan(source, undefined, "2026-08-18", runTeamCommand);

    expect(runTeamCommand).toHaveBeenCalledTimes(1);
    expect(result?.plan).toEqual(serverPlan);
    expect(result?.state.dailyPlans).toEqual([serverPlan]);
  });

  it("does not issue a create request when the server already supplied today's plan", async () => {
    const source = createTestState();
    const runTeamCommand = vi.fn();
    const existing = source.dailyPlans[0];

    const result = await ensureRemoteDailyPlan(source, undefined, existing.date, runTeamCommand);

    expect(runTeamCommand).not.toHaveBeenCalled();
    expect(result?.plan).toEqual(existing);
  });
});
