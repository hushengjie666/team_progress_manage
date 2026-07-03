import { describe, expect, it } from "vitest";
import {
  getTodayPlan,
  removeTaskFromTodayInState,
  startTimerInState,
} from "./appModel";
import { createInitialState } from "./test/fixtures";
import {
  createProjectInState,
} from "./teamProgress";
import type { AppState, Task } from "./types";
import { addTaskToTodayInState } from "./workSessionTransitions";

describe("timer today queue", () => {
  it("adds a focused task to today's queue when starting work", () => {
    const state = createInitialState();
    const taskId = state.tasks[1].id;
    const initialPlan = getTodayPlan(state);
    const withoutTaskInToday: AppState = {
      ...state,
      tasks: state.tasks.map((task) => (task.id === taskId ? { ...task, status: "pool" as const } : task)),
      dailyPlans: state.dailyPlans.some((plan) => plan.id === initialPlan.id)
        ? state.dailyPlans.map((plan) => (plan.id === initialPlan.id ? { ...plan, committedTaskIds: [] } : plan))
        : [{ ...initialPlan, committedTaskIds: [] }],
    };

    const started = startTimerInState(
      withoutTaskInToday,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      "session_queue_start",
    );

    expect(getTodayPlan(started).committedTaskIds).toContain(taskId);
    expect(started.tasks.find((task) => task.id === taskId)).toMatchObject({ status: "in_progress" });
    expect(started.workSessions[0]).toMatchObject({ taskId, status: "active" });
  });

  it("claims an unassigned task for the current member when starting focus", () => {
    const state = createInitialState();
    const taskId = state.tasks[3].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      "session_claim_unassigned",
    );

    expect(started.tasks.find((task) => task.id === taskId)).toMatchObject({
      primaryExecutorMemberId: "member_owner",
      status: "in_progress",
    });
    expect(started.workSessions[0]).toMatchObject({
      taskId,
      executorMemberId: "member_owner",
    });
  });

  it("claims an unassigned task for the current member when adding it to today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[3].id;

    const queued = addTaskToTodayInState(state, taskId, "2026-05-10T08:00:00.000Z");

    expect(getTodayPlan(queued).committedTaskIds).toContain(taskId);
    expect(queued.tasks.find((task) => task.id === taskId)).toMatchObject({
      primaryExecutorMemberId: "member_owner",
      status: "committed",
    });
  });

  it("claims a cross-project unassigned task with the current account's project member", () => {
    const state = createInitialState();
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "第二项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_queue_claim`,
      { accountId: "account_owner", name: "项目负责人", email: "owner@example.com" },
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_queue_claim")!;
    const task: Task = {
      ...state.tasks[3],
      id: "queue_cross_project_unassigned",
      projectId: "project_queue_claim",
      project: "图像识别",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "pool",
    };

    const queued = addTaskToTodayInState(
      { ...withSecondProject, tasks: [task] },
      task.id,
      "2026-05-10T09:10:00.000Z",
    );

    expect(queued.tasks.find((item) => item.id === task.id)?.primaryExecutorMemberId).toBe(secondMember.id);
  });

  it("ends active work sessions when removing a task from today's queue", () => {
    const state = createInitialState();
    const taskId = state.tasks[0].id;
    const started = startTimerInState(
      state,
      "focus",
      taskId,
      "2026-05-10T08:00:00.000Z",
      "session_remove_today",
    );

    const removed = removeTaskFromTodayInState(started, taskId, "2026-05-10T08:12:00.000Z");

    expect(getTodayPlan(removed).committedTaskIds).not.toContain(taskId);
    expect(removed.activeTimer).toBeUndefined();
    expect(removed.workSessions.find((session) => session.taskId === taskId)).toMatchObject({
      status: "ended",
      endedAt: "2026-05-10T08:12:00.000Z",
    });
    expect(removed.executionSignals[0]).toMatchObject({
      taskId,
      type: "work_ended",
      payload: expect.objectContaining({ reason: "removed_from_today" }),
    });
  });
});
