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
  it("sorts tasks within their status and keeps project groups in queue order", () => {
    const tasks = [
      task("task_a1", "project_a", "项目 A", 10),
      task("task_b1", "project_b", "项目 B", 20),
      task("task_a2", "project_a", "项目 A", 30),
    ];

    const ordered = buildFocusTaskList([tasks[2], tasks[0], tasks[1]]);

    expect(ordered.map((item) => item.id)).toEqual(["task_a1", "task_b1", "task_a2"]);
    expect(groupFocusTasksByProject(ordered).map((group) => group.projectId)).toEqual(["project_a", "project_b"]);
  });

  it("puts unfinished tasks before completed tasks", () => {
    const completedEarly = { ...task("task_completed", "project_a", "项目 A", 10), status: "completed" as const };
    const committedLater = task("task_committed", "project_a", "项目 A", 20);
    const reviewLater = { ...task("task_review", "project_a", "项目 A", 30), status: "pending_review" as const };

    const tasks = buildFocusTaskList([completedEarly, committedLater, reviewLater]);

    expect(tasks.map((item) => item.id)).toEqual([committedLater.id, reviewLater.id, completedEarly.id]);
  });

  it("keeps project positions when starting, switching, and completing tasks changes their status", () => {
    const tasks = [
      task("task_a1", "project_a", "项目 A", 10),
      task("task_b1", "project_b", "项目 B", 20),
      task("task_a2", "project_a", "项目 A", 30),
    ];
    for (const statuses of [
      ["committed", "committed", "committed"],
      ["committed", "in_progress", "committed"],
      ["committed", "in_progress", "in_progress"],
      ["completed", "pending_review", "completed"],
    ] as Task["status"][][]) {
      const updated = tasks.map((item, index) => ({ ...item, status: statuses[index] }));
      const groups = groupFocusTasksByProject(buildFocusTaskList(updated));
      expect(groups.map((group) => group.projectId)).toEqual(["project_a", "project_b"]);
      expect(groups[0].tasks.map((item) => item.id)).toEqual(statuses[2] === "in_progress"
        ? ["task_a2", "task_a1"] : ["task_a1", "task_a2"]);
    }
  });

  it("uses project identity to keep equal-order groups stable regardless of status sorting", () => {
    const first = task("task_a", "project_a", "项目 A", 10);
    const second = task("task_b", "project_b", "项目 B", 10);
    const active = { ...second, status: "in_progress" as const };
    expect(groupFocusTasksByProject(buildFocusTaskList([second, first])).map((group) => group.projectId))
      .toEqual(["project_a", "project_b"]);
    expect(groupFocusTasksByProject(buildFocusTaskList([first, active])).map((group) => group.projectId))
      .toEqual(["project_a", "project_b"]);
  });

  it("keeps tasks that are already waiting for review visible", () => {
    const committed = task("task_committed", "project_a", "项目 A", 10);
    const pendingReview = { ...task("task_review", "project_a", "项目 A", 20), status: "pending_review" as const };

    const tasks = buildFocusTaskList([committed, pendingReview]);

    expect(tasks.map((item) => item.id)).toEqual([committed.id, pendingReview.id]);
  });

  it("keeps completed tasks visible in the today task list", () => {
    const committed = task("task_committed", "project_a", "项目 A", 10);
    const completed = { ...task("task_completed", "project_a", "项目 A", 20), status: "completed" as const };

    const tasks = buildFocusTaskList([committed, completed]);

    expect(tasks.map((item) => item.id)).toEqual([committed.id, completed.id]);
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
    };

    expect(displayRemainingForTimer(active, new Date("2026-06-30T08:00:00.300Z"))).toBe(25 * 60);
    expect(displayRemainingForTimer(active, new Date("2026-06-30T08:00:01.100Z"))).toBe(24 * 60 + 59);
  });
});
