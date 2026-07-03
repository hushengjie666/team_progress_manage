import { describe, expect, it } from "vitest";
import { todayKey } from "./seed";
import { createInitialState } from "./test/fixtures";
import { buildProjectOverviewTaskBoard, deriveProjectDetailModel } from "./projectDetail";
import type { ProjectMember } from "./types";

describe("project detail overview model", () => {
  it("builds the project detail overview board from pooled work and member today work groups", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner");
    const reviewer = {
      ...owner!,
      id: "member_reviewer_overview",
      name: "协作者",
      roles: owner!.roles,
    };
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "overview_pool", projectId, status: "pool" as const, sortOrder: 1 },
      { ...baseTask, id: "overview_committed", projectId, status: "committed" as const, sortOrder: 2 },
      { ...baseTask, id: "overview_active", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner?.id, sortOrder: 3 },
      { ...baseTask, id: "overview_other_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: reviewer.id, sortOrder: 4 },
      { ...baseTask, id: "overview_unassigned", projectId, status: "in_progress" as const, primaryExecutorMemberId: undefined, sortOrder: 5 },
      { ...baseTask, id: "overview_review", projectId, status: "pending_review" as const, sortOrder: 6 },
      { ...baseTask, id: "overview_split", projectId, status: "split" as const, sortOrder: 7 },
      { ...baseTask, id: "overview_archived", projectId, status: "archived" as const, sortOrder: 8 },
    ];

    const idleMember: ProjectMember = {
      ...reviewer,
      id: "member_idle",
      name: "空闲成员",
      roles: ["executor"],
    };
    const board = buildProjectOverviewTaskBoard(
      tasks,
      [owner!, reviewer, idleMember],
      "overview_active",
      ["overview_active", "overview_committed", "overview_other_running", "overview_unassigned"],
    );

    expect(board.poolTasks.map((task) => task.id)).toEqual(["overview_pool", "overview_committed"]);
    expect(board.pendingReviewTasks.map((task) => task.id)).toEqual(["overview_review"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["overview_active", "overview_other_running", "overview_unassigned"]);
    expect(board.todayWorkGroups.map((group) => ({
      memberName: group.memberName,
      taskIds: group.tasks.map((task) => task.id),
      hasActiveTask: group.hasActiveTask,
    }))).toEqual([
      { memberName: "项目负责人", taskIds: ["overview_active", "overview_committed"], hasActiveTask: true },
      { memberName: "协作者", taskIds: ["overview_other_running"], hasActiveTask: false },
      { memberName: "未分配", taskIds: ["overview_unassigned"], hasActiveTask: false },
      { memberName: "空闲成员", taskIds: [], hasActiveTask: false },
    ]);
  });

  it("shows active project work even when it is missing from the current user's daily plan", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const owner = state.projectMembers.find((member) => member.id === "member_owner")!;
    const baseTask = state.tasks[0];
    const tasks = [
      { ...baseTask, id: "not_today_committed", projectId, status: "committed" as const, primaryExecutorMemberId: owner.id, sortOrder: 1 },
      { ...baseTask, id: "not_today_running", projectId, status: "in_progress" as const, primaryExecutorMemberId: owner.id, sortOrder: 2 },
    ];

    const board = buildProjectOverviewTaskBoard(tasks, [owner], "not_today_running", []);

    expect(board.poolTasks.map((task) => task.id)).toEqual(["not_today_committed"]);
    expect(board.inProgressTasks.map((task) => task.id)).toEqual(["not_today_running"]);
    expect(board.todayWorkGroups).toEqual([
      {
        memberId: owner.id,
        memberName: owner.name,
        tasks: [tasks[1]],
        hasActiveTask: true,
      },
    ]);
  });

  it("sorts accepted project detail tasks by newest review acceptance", () => {
    const state = createInitialState();
    const projectId = state.projects[0].id;
    const baseTask = state.tasks[0];
    const acceptedOld = {
      ...baseTask,
      id: "accepted_old",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T09:00:00.000Z",
      completedAt: "2026-05-10T09:00:00.000Z",
    };
    const acceptedNew = {
      ...baseTask,
      id: "accepted_new",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: "2026-05-10T11:00:00.000Z",
      completedAt: "2026-05-10T11:00:00.000Z",
    };
    const manuallyCompleted = {
      ...baseTask,
      id: "manual_done",
      projectId,
      status: "completed" as const,
      reviewAcceptedAt: undefined,
      completedAt: "2026-05-10T12:00:00.000Z",
    };
    const model = deriveProjectDetailModel(
      { ...state, tasks: [manuallyCompleted, acceptedOld, acceptedNew, ...state.tasks] },
      projectId,
      { query: "", status: "all", executor: "all", priority: "all", sort: "status" },
      todayKey(),
    );

    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_new");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("accepted_old");
    expect(model?.overviewTasks.map((task) => task.id)).not.toContain("manual_done");
    expect(model?.acceptedTasks.map((task) => task.id)).toEqual(["accepted_new", "accepted_old"]);
  });
});
