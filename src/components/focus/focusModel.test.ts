import { describe, expect, it } from "vitest";
import type { ActiveTimer, Task } from "../../types";
import { buildFocusTaskList, displayRemainingForTimer, groupFocusTasksByProject } from "./focusModel";

const task = (id: string, projectId: string, project: string, sortOrder: number): Task => ({
  id,
  title: id,
  notes: "",
  tags: [],
  projectId,
  project,
  collaboratorMemberIds: [],
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  estimatePomodoros: 1,
  status: "committed",
  repeatRule: "none",
  subtasks: [],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: "2026-06-30T08:00:00.000Z",
  updatedAt: "2026-06-30T08:00:00.000Z",
});

describe("focus task ordering", () => {
  it("keeps task and project group order stable when the active task changes", () => {
    const tasks = [
      task("task_a1", "project_a", "项目 A", 10),
      task("task_b1", "project_b", "项目 B", 20),
      task("task_a2", "project_a", "项目 A", 30),
    ];

    const idle = buildFocusTaskList(undefined, tasks);
    const activeSecondProject = buildFocusTaskList(tasks[1], tasks, "task_b1");

    expect(idle.map((item) => item.id)).toEqual(["task_a1", "task_b1", "task_a2"]);
    expect(activeSecondProject.map((item) => item.id)).toEqual(["task_a1", "task_b1", "task_a2"]);
    expect(groupFocusTasksByProject(activeSecondProject).map((group) => group.projectId)).toEqual(["project_a", "project_b"]);
  });

  it("keeps the full minute visible briefly, then moves on the next second", () => {
    const active: ActiveTimer = {
      sessionId: "session_timer_display",
      mode: "focus",
      duration: 25 * 60,
      remaining: 25 * 60,
      isRunning: true,
      startedAt: "2026-06-30T08:00:00.000Z",
      plannedEndAt: "2026-06-30T08:25:00.000Z",
      totalPausedSeconds: 0,
      cycleIndex: 1,
      strictStarted: false,
    };

    expect(displayRemainingForTimer(active, new Date("2026-06-30T08:00:00.300Z"))).toBe(25 * 60);
    expect(displayRemainingForTimer(active, new Date("2026-06-30T08:00:01.100Z"))).toBe(24 * 60 + 59);
  });
});
