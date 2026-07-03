import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import {
  filterTodayCommittedTasksForMember,
} from "./projectOverview";
import { createInitialState } from "./test/fixtures";
import type { AppState, ProjectMember, Task } from "./types";

describe("my project today tasks", () => {
  it("filters today committed tasks to the current member for the focus todo list", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "胡圣杰",
      email: "husj",
      roles: ["executor"],
    };
    const ownerTask = {
      ...state.tasks[0],
      id: "today_owner_task",
      primaryExecutorMemberId: owner.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const teammateTask = {
      ...state.tasks[1],
      id: "today_teammate_task",
      primaryExecutorMemberId: teammate.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const unassignedTask = {
      ...state.tasks[2],
      id: "today_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const next: AppState = {
      ...state,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [ownerTask, teammateTask, unassignedTask],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [ownerTask.id, teammateTask.id, unassignedTask.id],
        },
      ],
    };

    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([ownerTask.id]);
  });

  it("keeps old unassigned committed tasks visible only for the member who has worked on them", () => {
    const state = createInitialState();
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const teammate: ProjectMember = {
      ...owner,
      id: "member_teammate",
      accountId: "account_teammate",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    };
    const unassignedTask = {
      ...state.tasks[0],
      id: "today_worked_unassigned_task",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "in_progress" as const,
    };
    const next: AppState = {
      ...state,
      projectMembers: [...state.projectMembers, teammate],
      tasks: [unassignedTask],
      workSessions: [
        {
          id: "work_session_owner_unassigned",
          taskId: unassignedTask.id,
          executorMemberId: owner.id,
          focusSessionId: "focus_owner_unassigned",
          status: "ended",
          startedAt: "2026-05-10T09:00:00.000Z",
          endedAt: "2026-05-10T09:25:00.000Z",
          totalPausedSeconds: 0,
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:25:00.000Z",
        },
      ],
      dailyPlans: [
        {
          ...getTodayPlan(state),
          committedTaskIds: [unassignedTask.id],
        },
      ],
    };
    const committedTasks = next.dailyPlans[0].committedTaskIds
      .map((id) => next.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(filterTodayCommittedTasksForMember(next, committedTasks, owner).map((task) => task.id)).toEqual([unassignedTask.id]);
    expect(filterTodayCommittedTasksForMember(next, committedTasks, teammate).map((task) => task.id)).toEqual([]);
  });
});
