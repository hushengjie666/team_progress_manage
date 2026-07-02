import { describe, expect, it } from "vitest";
import type { Task } from "../types";
import { commandPaletteEnterTarget, commandPaletteMatches } from "./CommandPalette";

const now = "2026-07-01T00:00:00.000Z";

const task = (overrides: Partial<Task> = {}): Task => ({
  id: "task_1",
  title: "QA巡检任务",
  notes: "",
  tags: [],
  projectId: "project_1",
  project: "QA项目",
  priority: "medium",
  severity: "medium",
  stage: "planning",
  estimatePomodoros: 1,
  status: "pool",
  subtasks: [],
  sortOrder: 0,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

describe("commandPaletteEnterTarget", () => {
  it("runs the first matched command before quick creating", () => {
    const target = commandPaletteEnterTarget(commandPaletteMatches("团队后台", []));

    expect(target).toEqual({ action: "open_sync_settings" });
  });

  it("opens the first matched task when no command matches", () => {
    const target = commandPaletteEnterTarget(commandPaletteMatches("QA巡检", [task()]));

    expect(target).toEqual({ action: "open_task", taskId: "task_1" });
  });

  it("quick creates only when there are no command or task matches", () => {
    const target = commandPaletteEnterTarget(commandPaletteMatches("明天10点 写周报 #工作 2p", []));

    expect(target?.action).toBe("add_quick_task");
    expect(target?.parsed?.title).toBe("写周报");
  });

  it("does nothing for an empty query", () => {
    expect(commandPaletteEnterTarget(commandPaletteMatches("", [task()]))).toBeUndefined();
  });
});
