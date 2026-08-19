import { describe, expect, it } from "vitest";
import { initialFilters } from "./appTaskMetadata";
import { createInitialState } from "./test/fixtures";
import { workbenchTask, workbenchTodayPlan } from "./test/workbenchFixtures";
import { poolTasksForFilters } from "./workbenchPoolTasks";

describe("workbench pool tasks", () => {
  it("shows the newest task first by default", () => {
    const state = createInitialState();
    const olderTask = {
      ...workbenchTask("task_older", "pool", 10),
      createdAt: "2026-06-30T08:00:00.000Z",
    };
    const newestTask = {
      ...workbenchTask("task_newest", "pool", 20),
      createdAt: "2026-06-30T09:00:00.000Z",
    };

    const tasks = poolTasksForFilters(
      { ...state, tasks: [olderTask, newestTask] },
      workbenchTodayPlan(),
      initialFilters,
    );

    expect(tasks.map((task) => task.id)).toEqual(["task_newest", "task_older"]);
  });

  it("keeps manual ordering available when explicitly selected", () => {
    const state = createInitialState();
    const firstTask = workbenchTask("task_first", "pool", 10);
    const secondTask = workbenchTask("task_second", "pool", 20);

    const tasks = poolTasksForFilters(
      { ...state, tasks: [secondTask, firstTask] },
      workbenchTodayPlan(),
      { ...initialFilters, sort: "manual" },
    );

    expect(tasks.map((task) => task.id)).toEqual(["task_first", "task_second"]);
  });
});
