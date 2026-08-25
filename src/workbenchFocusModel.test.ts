import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { activeTimerForFocus, currentTaskForFocus } from "./workbenchModel";
import type { Task } from "./types";

const task = (id: string, status: Task["status"], sortOrder: number): Task => ({
  id,
  title: id,
  notes: "",
  tags: [],
  projectId: "project_starter",
  project: "TimeManage",
  collaboratorMemberIds: [],
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  estimatePomodoros: 1,
  status,
  repeatRule: "none",
  subtasks: [],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: "2026-06-30T08:00:00.000Z",
  updatedAt: "2026-06-30T08:00:00.000Z",
});

describe("workbench focus model", () => {
  it("keeps pending-review tasks visible as the current focus feedback", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const committedTask = task("task_committed", "committed", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, committedTask], activeTimer: undefined },
      [pendingReviewTask, committedTask],
    );

    expect(next?.id).toBe(pendingReviewTask.id);
  });

  it("still prefers in-progress tasks over pending review feedback", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const inProgressTask = task("task_running", "in_progress", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, inProgressTask], activeTimer: undefined },
      [pendingReviewTask, inProgressTask],
    );

    expect(next?.id).toBe(inProgressTask.id);
  });

  it("keeps the submitted review task pinned in the focus panel until the user switches", () => {
    const state = createInitialState();
    const pendingReviewTask = task("task_review", "pending_review", 10);
    const inProgressTask = task("task_running", "in_progress", 20);
    const next = currentTaskForFocus(
      { ...state, tasks: [pendingReviewTask, inProgressTask], activeTimer: undefined },
      [pendingReviewTask, inProgressTask],
      pendingReviewTask.id,
    );

    expect(next?.id).toBe(pendingReviewTask.id);
  });

  it("does not let an active task from another workspace override the selected workspace", () => {
    const state = createInitialState();
    const sharedTask = { ...task("task_shared_running", "in_progress", 10), projectId: "project_shared" };
    const privateTask = { ...task("task_private", "committed", 20), projectId: "project_private" };
    const activeTimer = {
      sessionId: "session_shared",
      taskId: sharedTask.id,
      mode: "focus" as const,
      duration: 1500,
      remaining: 900,
      isRunning: true,
      startedAt: "2026-06-30T08:00:00.000Z",
      plannedEndAt: "2026-06-30T08:25:00.000Z",
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const scopedState = { ...state, tasks: [sharedTask, privateTask], activeTimer };
    const privateProjectIds = new Set([privateTask.projectId]);

    expect(activeTimerForFocus(scopedState, privateProjectIds)).toBeUndefined();
    expect(currentTaskForFocus(scopedState, [privateTask], null, privateProjectIds)?.id).toBe(privateTask.id);
  });

  it("keeps a timed task visible when it belongs to the selected workspace", () => {
    const state = createInitialState();
    const runningTask = { ...task("task_private_running", "in_progress", 10), projectId: "project_private" };
    const activeTimer = {
      sessionId: "session_private",
      taskId: runningTask.id,
      mode: "focus" as const,
      duration: 1500,
      remaining: 900,
      isRunning: true,
      startedAt: "2026-06-30T08:00:00.000Z",
      plannedEndAt: "2026-06-30T08:25:00.000Z",
      totalPausedSeconds: 0,
      cycleIndex: 1,
    };
    const scopedState = { ...state, tasks: [runningTask], activeTimer };
    const privateProjectIds = new Set([runningTask.projectId]);

    expect(activeTimerForFocus(scopedState, privateProjectIds)).toBe(activeTimer);
    expect(currentTaskForFocus(scopedState, [], null, privateProjectIds)?.id).toBe(runningTask.id);
  });
});
