import { describe, expect, it } from "vitest";
import { buildScheduleItems, splitScheduleTasks, taskScheduleDateRange } from "./scheduleCalendar";
import type { Task } from "./types";

const task = (overrides: Partial<Task>): Task => ({
  id: "task",
  title: "排期任务",
  notes: "",
  tags: [],
  projectId: "project",
  project: "项目",
  collaboratorMemberIds: [],
  progressPercent: 0,
  progressNote: "",
  priority: "medium",
  severity: "medium",
  stage: "development",
  estimatePomodoros: 4,
  status: "committed",
  repeatRule: "none",
  subtasks: [],
  sortOrder: 0,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: "2026-05-01T08:00:00.000Z",
  updatedAt: "2026-05-01T08:00:00.000Z",
  ...overrides,
});

describe("schedule calendar model", () => {
  it("reads explicit date ranges and normalizes reversed dates", () => {
    expect(taskScheduleDateRange(task({
      expectedStartAt: "2026-05-08T09:00:00.000Z",
      expectedFinishAt: "2026-05-10T18:00:00.000Z",
    }))).toEqual({ start: "2026-05-08", end: "2026-05-10" });

    expect(taskScheduleDateRange(task({
      expectedStartAt: "2026-05-12T09:00:00.000Z",
      expectedFinishAt: "2026-05-10T18:00:00.000Z",
    }))).toEqual({ start: "2026-05-10", end: "2026-05-12" });
  });

  it("clips visible task bars to the window and assigns overlapping lanes", () => {
    const items = buildScheduleItems([
      task({ id: "early", expectedStartAt: "2026-05-09", expectedFinishAt: "2026-05-12" }),
      task({ id: "overlap", expectedStartAt: "2026-05-11", expectedFinishAt: "2026-05-13" }),
      task({ id: "later", expectedStartAt: "2026-05-14", expectedFinishAt: "2026-05-15" }),
    ], "2026-05-10", 7);

    expect(items.map((item) => ({
      id: item.task.id,
      gridColumn: item.gridColumn,
      clippedStart: item.clippedStart,
      visibleDays: item.visibleDays,
      lane: item.lane,
    }))).toEqual([
      { id: "early", gridColumn: "1 / 4", clippedStart: true, visibleDays: 3, lane: 0 },
      { id: "overlap", gridColumn: "2 / 5", clippedStart: false, visibleDays: 3, lane: 1 },
      { id: "later", gridColumn: "5 / 7", clippedStart: false, visibleDays: 2, lane: 0 },
    ]);
  });

  it("separates scheduled and unscheduled visible tasks without archived items", () => {
    const result = splitScheduleTasks([
      task({ id: "archived", status: "archived", dueAt: "2026-05-10" }),
      task({ id: "later_scheduled", dueAt: "2026-05-12", sortOrder: 20 }),
      task({ id: "early_scheduled", dueAt: "2026-05-10", sortOrder: 10 }),
      task({ id: "unscheduled", sortOrder: 30 }),
    ]);

    expect(result.scheduledTasks.map((item) => item.id)).toEqual(["early_scheduled", "later_scheduled"]);
    expect(result.unscheduledTasks.map((item) => item.id)).toEqual(["unscheduled"]);
  });
});
