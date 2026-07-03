import { describe, expect, it } from "vitest";
import { createInitialState, todayKey } from "./seed";
import { workbenchTask, workbenchTodayPlan } from "./test/workbenchFixtures";
import { deriveWorkspaceModel } from "./workbenchModel";
import type { AppState, Task } from "./types";

const starterTask = (
  state: AppState,
  id: string,
  status: Task["status"],
  sortOrder: number,
  overrides: Partial<Task> = {},
): Task => ({
  ...workbenchTask(id, status, sortOrder),
  projectId: state.projects[0].id,
  project: state.projects[0].name,
  ...overrides,
});

describe("workbench today queue", () => {
  it("keeps completed committed tasks visible in today's work queue", () => {
    const state = createInitialState();
    const completedTask = starterTask(state, "task_completed_today", "completed", 10, {
      primaryExecutorMemberId: state.projectMembers[0].id,
    });
    const committedTask = starterTask(state, "task_committed_today", "committed", 20, {
      primaryExecutorMemberId: state.projectMembers[0].id,
    });
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask, committedTask] },
      workbenchTodayPlan([completedTask.id, committedTask.id], { completedPomodoros: 1 }),
      0,
      [completedTask, committedTask],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_today", "task_committed_today"]);
  });

  it("keeps completed tasks visible when they are no longer in today's committed ids", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const completedTask = starterTask(state, "task_completed_removed_from_plan", "completed", 10, {
      primaryExecutorMemberId: state.projectMembers[0].id,
      completedAt: `${todayKey()}T09:30:00.000Z`,
    });
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask] },
      workbenchTodayPlan([], { completedPomodoros: 1 }),
      0,
      [],
      [],
      [],
    );

    expect(model.availableWorkbenchProjectIds).toEqual([projectId]);
    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_removed_from_plan"]);
  });

  it("does not show completed tasks from earlier days in today's work queue", () => {
    const state = createInitialState();
    const completedTask = starterTask(state, "task_completed_yesterday", "completed", 10, {
      primaryExecutorMemberId: state.projectMembers[0].id,
      completedAt: "2026-06-29T09:30:00.000Z",
    });
    const model = deriveWorkspaceModel(
      { ...state, tasks: [completedTask] },
      workbenchTodayPlan([], { date: "2026-06-30", completedPomodoros: 1 }),
      0,
      [],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks).toEqual([]);
  });

  it("keeps completed tasks visible when the member worked on them without direct assignment", () => {
    const state = createInitialState();
    const completedTask = starterTask(state, "task_completed_by_work_session", "completed", 10, {
      primaryExecutorMemberId: undefined,
      completedAt: `${todayKey()}T09:30:00.000Z`,
    });
    const model = deriveWorkspaceModel(
      {
        ...state,
        tasks: [completedTask],
        workSessions: [
          {
            id: "work_session_test",
            taskId: completedTask.id,
            executorMemberId: state.projectMembers[0].id,
            focusSessionId: "session_test",
            status: "ended",
            startedAt: `${todayKey()}T09:00:00.000Z`,
            endedAt: `${todayKey()}T09:30:00.000Z`,
            totalPausedSeconds: 0,
            createdAt: `${todayKey()}T09:00:00.000Z`,
            updatedAt: `${todayKey()}T09:30:00.000Z`,
          },
        ],
      },
      workbenchTodayPlan([], { completedPomodoros: 1 }),
      0,
      [],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual(["task_completed_by_work_session"]);
  });

  it("keeps unassigned today tasks visible for the project owner like member status does", () => {
    const state = createInitialState();
    const unassignedCompletedTask = starterTask(state, "task_owner_unassigned_completed", "completed", 10, {
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      completedAt: `${todayKey()}T09:30:00.000Z`,
    });
    const unassignedCommittedTask = starterTask(state, "task_owner_unassigned_committed", "committed", 20, {
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    });
    const model = deriveWorkspaceModel(
      { ...state, tasks: [unassignedCompletedTask, unassignedCommittedTask] },
      workbenchTodayPlan([unassignedCompletedTask.id, unassignedCommittedTask.id], { completedPomodoros: 1 }),
      0,
      [unassignedCompletedTask, unassignedCommittedTask],
      [],
      [],
    );

    expect(model.committedWorkbenchTasks.map((item) => item.id)).toEqual([
      "task_owner_unassigned_completed",
      "task_owner_unassigned_committed",
    ]);
  });

  it("keeps unassigned pool tasks available for the unassigned visibility toggle", () => {
    const state = createInitialState();
    const unassignedTask = starterTask(state, "task_unassigned", "pool", 10, {
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
    });
    const assignedTask = starterTask(state, "task_assigned", "pool", 20, {
      primaryExecutorMemberId: state.projectMembers[0].id,
    });
    const model = deriveWorkspaceModel(
      { ...state, tasks: [unassignedTask, assignedTask] },
      workbenchTodayPlan(),
      0,
      [],
      [unassignedTask, assignedTask],
      [],
    );

    expect(model.poolWorkbenchTasks.map((item) => item.id)).toEqual(["task_unassigned", "task_assigned"]);
  });
});
