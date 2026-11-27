import { describe, expect, it } from "vitest";
import { createInitialState } from "../../test/fixtures";
import { workbenchTask, workbenchTodayPlan } from "../../test/workbenchFixtures";
import { today } from "../../appClock";
import { completionSummary } from "./completionModel";

function sample() {
  const state = createInitialState();
  const ready = { ...workbenchTask("a", "committed", 1), projectId: state.projects[0].id,
    primaryExecutorMemberId: state.projectMembers[0].id };
  const finished = { ...ready, status: "completed" as const, completedAt: new Date().toISOString() };
  state.tasks = [finished];
  state.dailyPlans = [{ ...workbenchTodayPlan(["a"]), date: today() }];
  return { state, ready, finished };
}

describe("completion feedback for a confirmed action", () => {
  it("upgrades only when this completion clears the visible plan", () => {
    const { state, ready, finished } = sample();
    expect(completionSummary("a", [ready], state, null)).toEqual({ achievedToday: 1, plannedCount: 1, allClear: true });
    expect(completionSummary("a", [finished], state, null).allClear).toBe(false);
    state.tasks.push({ ...ready, id: "b", status: "pending_review" });
    state.dailyPlans[0].committedTaskIds.push("b");
    expect(completionSummary("a", [ready], state, null).allClear).toBe(false);
  });

  it("counts unplanned completions without upgrading an empty or previously cleared plan", () => {
    const { state, finished } = sample();
    state.tasks.push({ ...finished, id: "b" });
    expect(completionSummary("b", [finished], state, null)).toEqual({ achievedToday: 2, plannedCount: 1, allClear: false });
    state.dailyPlans[0].committedTaskIds = [];
    expect(completionSummary("b", [], state, null)).toEqual({ achievedToday: 2, plannedCount: 0, allClear: false });
  });
});
