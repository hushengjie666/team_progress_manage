import { describe, expect, it } from "vitest";
import { todayKey } from "./seed";
import { generateRecurringTask } from "./recurrence";
import { createInitialState } from "./test/fixtures";

describe("recurring tasks", () => {
  it("generates the next recurring task into the pool", () => {
    const state = createInitialState();
    const source = { ...state.tasks[1], repeatRule: "daily" as const, completedAt: `${todayKey()}T09:00:00.000Z` };
    const next = generateRecurringTask(source, `${todayKey()}T09:05:00.000Z`);
    expect(next).toMatchObject({
      status: "pool",
      recurrenceParentId: source.id,
      actualPomodoros: 0,
    });
    expect(next?.id).not.toBe(source.id);
  });

  it("generates weekday and after-completion recurring tasks", () => {
    const state = createInitialState();
    const weekdaySource = {
      ...state.tasks[0],
      repeatRule: "weekdays" as const,
      repeatWeekdays: [1, 2, 3, 4, 5],
      dueAt: "2026-05-15T09:00:00.000Z",
    };
    const weekdayNext = generateRecurringTask(weekdaySource, "2026-05-15T10:00:00.000Z");
    expect(new Date(weekdayNext!.dueAt!).getDay()).toBe(1);

    const afterSource = {
      ...state.tasks[0],
      repeatRule: "after_completion" as const,
      repeatIntervalDays: 3,
      dueAt: "2026-05-01T09:00:00.000Z",
    };
    const afterNext = generateRecurringTask(afterSource, "2026-05-10T10:00:00.000Z");
    expect(afterNext?.dueAt?.slice(0, 10)).toBe("2026-05-13");
  });
});
