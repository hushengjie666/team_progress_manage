import { describe, expect, it } from "vitest";
import {
  deriveRewardState,
  estimateDeltaLabel,
  planPressure,
  suggestedCapacity,
  taskSuggestions,
  computeStreak,
} from "./domain";
import { taskStageOptionsForMode } from "./appModel";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import type { AppState, FocusSession } from "./types";

describe("planning and rewards", () => {
  it("returns project-specific task stage options", () => {
    expect(taskStageOptionsForMode("regular").map((stage) => stage.value)).toEqual(["planning", "execution", "check"]);
    expect(taskStageOptionsForMode("software").map((stage) => stage.value)).toEqual([
      "sales",
      "requirements",
      "design",
      "development",
      "testing",
      "deployment",
      "acceptance",
    ]);
  });

  it("reduces suggested capacity after a high interruption day", () => {
    const state = createInitialState();
    const today = todayKey();
    const next: AppState = {
      ...state,
      dailyPlans: [
        ...state.dailyPlans,
        ...Array.from({ length: 7 }, (_, index) => ({
          ...state.dailyPlans[0],
          id: `history_${index}`,
          date: todayKey(new Date(Date.UTC(2026, 4, index + 1))),
          completedPomodoros: 6,
        })),
      ],
      interruptions: Array.from({ length: 4 }, (_, index) => ({
        id: `interrupt_${index}`,
        type: "internal" as const,
        action: "defer" as const,
        note: "想刷消息",
        createdAt: `${today}T10:0${index}:00.000Z`,
      })),
    };
    expect(suggestedCapacity(next, today)).toBeLessThanOrEqual(5);
  });

  it("earns focus and streak badges from state", () => {
    const state = createInitialState();
    const session: FocusSession = {
      id: "session_done",
      taskId: state.tasks[0].id,
      mode: "focus",
      duration: 1500,
      startedAt: `${todayKey()}T08:00:00.000Z`,
      endedAt: `${todayKey()}T08:25:00.000Z`,
      outcome: "completed",
      interruptionCounts: { internal: 0, external: 0 },
    };
    const next = {
      ...state,
      focusSessions: [session],
      dailyPlans: state.dailyPlans.map((plan) => ({ ...plan, completedPomodoros: state.rewardState.dailyGoal, reviewedAt: `${todayKey()}T21:00:00.000Z` })),
    };
    const reward = deriveRewardState(next);
    expect(reward.streak).toBeGreaterThanOrEqual(1);
    expect(reward.badges).toContain("首个番茄");
  });

  it("scores plan pressure and task suggestions", () => {
    const state = createInitialState();
    const pressure = planPressure(state, state.dailyPlans[0]);
    expect(pressure.level).toBe("light");
    const suggestions = taskSuggestions(state);
    expect(suggestions.some((item) => item.action === "split")).toBe(true);
    expect(suggestions[0].score).toBeGreaterThanOrEqual(suggestions[suggestions.length - 1]?.score ?? 0);
  });

  it("formats estimate deltas for humans", () => {
    expect(estimateDeltaLabel(3, 5)).toBe("低估 2 个番茄");
    expect(estimateDeltaLabel(5, 3)).toBe("高估 2 个番茄");
    expect(estimateDeltaLabel(4, 4)).toBe("估算准确");
  });

  it("does not reset streak while today is still in progress", () => {
    const state = createInitialState();
    const yesterday = todayKey(new Date(Date.now() - 86_400_000));
    const next: AppState = {
      ...state,
      dailyPlans: [
        { ...state.dailyPlans[0], completedPomodoros: 1 },
        { ...state.dailyPlans[0], id: "yesterday", date: yesterday, completedPomodoros: state.rewardState.dailyGoal },
      ],
    };
    expect(computeStreak(next)).toBe(1);
  });

});
