import { describe, expect, it } from "vitest";
import {
  getTodayPlan,
  removeTaskFromTodayInState,
  startTimerInState,
} from "./appModel";
import { currentAccountDailyPlanForWorkspaceDate } from "./dailyPlanScope";
import { createInitialState } from "./test/fixtures";
import {
  createProjectInState,
} from "./teamProgress";
import type { AppState, Task } from "./types";
import { addTaskToTodayInState } from "./workSessionTransitions";

describe("timer today queue", () => {
  it("adds a shared workspace project task to the task workspace daily plan", () => {
    const state = createInitialState();
    const privateWorkspace = {
      id: "workspace_private_owner",
      name: "私人工作区",
      type: "private" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-10T08:00:00.000Z",
    };
    const sharedWorkspace = {
      id: "workspace_shared_delivery",
      name: "协作工作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-10T08:00:00.000Z",
    };
    const taskId = "task_shared_today_queue";
    const task: Task = {
      ...state.tasks[2],
      id: taskId,
      workspaceId: sharedWorkspace.id,
      projectId: state.projects[0].id,
      status: "pool",
    };

    const queued = addTaskToTodayInState(
      {
        ...state,
        auth: {
          ...state.auth,
          status: "authenticated",
          account: {
            id: "account_owner",
            workspaceId: privateWorkspace.id,
            name: "项目负责人",
            email: "owner@example.com",
            createdAt: "2026-05-10T08:00:00.000Z",
            updatedAt: "2026-05-10T08:00:00.000Z",
          },
          workspace: privateWorkspace,
          workspaces: [privateWorkspace, sharedWorkspace],
        },
        projects: state.projects.map((project) => ({ ...project, workspaceId: sharedWorkspace.id })),
        projectMembers: state.projectMembers.map((member) => ({ ...member, workspaceId: sharedWorkspace.id })),
        tasks: [task],
        dailyPlans: [],
      },
      taskId,
      "2026-05-10T09:00:00.000Z",
    );

    expect(currentAccountDailyPlanForWorkspaceDate(queued, sharedWorkspace.id, getTodayPlan(queued).date)?.committedTaskIds).toEqual([taskId]);
    expect(currentAccountDailyPlanForWorkspaceDate(queued, privateWorkspace.id, getTodayPlan(queued).date)).toBeUndefined();
    expect(queued.tasks.find((item) => item.id === taskId)?.workspaceId).toBe(sharedWorkspace.id);
  });

  it("starts work on a shared workspace task without writing the private workspace plan", () => {
    const state = createInitialState();
    const privateWorkspace = {
      id: "workspace_private_timer",
      name: "私人工作区",
      type: "private" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-10T08:00:00.000Z",
    };
    const sharedWorkspace = {
      id: "workspace_shared_timer",
      name: "协作工作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-05-10T08:00:00.000Z",
      updatedAt: "2026-05-10T08:00:00.000Z",
    };
    const taskId = "task_shared_timer_start";
    const task: Task = {
      ...state.tasks[1],
      id: taskId,
      workspaceId: sharedWorkspace.id,
      projectId: state.projects[0].id,
      status: "pool",
    };

    const started = startTimerInState(
      {
        ...state,
        auth: {
          ...state.auth,
          status: "authenticated",
          account: {
            id: "account_owner",
            workspaceId: privateWorkspace.id,
            name: "项目负责人",
            email: "owner@example.com",
            createdAt: "2026-05-10T08:00:00.000Z",
            updatedAt: "2026-05-10T08:00:00.000Z",
          },
          workspace: privateWorkspace,
          workspaces: [privateWorkspace, sharedWorkspace],
        },
        projects: state.projects.map((project) => ({ ...project, workspaceId: sharedWorkspace.id })),
        projectMembers: state.projectMembers.map((member) => ({ ...member, workspaceId: sharedWorkspace.id })),
        tasks: [task],
        dailyPlans: [],
      },
      "focus",
      taskId,
      "2026-05-10T09:05:00.000Z",
      "session_shared_timer_start",
    );

    expect(currentAccountDailyPlanForWorkspaceDate(started, sharedWorkspace.id, getTodayPlan(started).date)?.committedTaskIds).toEqual([taskId]);
    expect(currentAccountDailyPlanForWorkspaceDate(started, privateWorkspace.id, getTodayPlan(started).date)).toBeUndefined();
    expect(started.tasks.find((item) => item.id === taskId)?.workspaceId).toBe(sharedWorkspace.id);
  });

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

  it("creates a project executor binding when a workspace member claims an unassigned task", () => {
    const state = createInitialState();
    const workspace = {
      id: "workspace_claim",
      name: "协作工作区",
      type: "shared" as const,
      ownerAccountId: "account_owner",
      createdAt: "2026-05-10T09:00:00.000Z",
      updatedAt: "2026-05-10T09:00:00.000Z",
    };
    const task: Task = {
      ...state.tasks[3],
      id: "queue_workspace_member_claim",
      workspaceId: workspace.id,
      projectId: state.projects[0].id,
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "pool",
    };
    const queued = addTaskToTodayInState(
      {
        ...state,
        auth: {
          ...state.auth,
          status: "authenticated",
          account: {
            id: "account_wangyuqiao",
            workspaceId: workspace.id,
            name: "王昱桥",
            email: "wangyuqiao",
            createdAt: "2026-05-10T09:00:00.000Z",
            updatedAt: "2026-05-10T09:00:00.000Z",
          },
          workspace,
          workspaces: [workspace],
          workspaceMemberships: [{
            id: "membership_workspace_claim_wangyuqiao",
            workspaceId: workspace.id,
            accountId: "account_wangyuqiao",
            name: "王昱桥",
            email: "wangyuqiao",
            role: "member",
            status: "active",
            createdAt: "2026-05-10T09:00:00.000Z",
            updatedAt: "2026-05-10T09:00:00.000Z",
          }],
        },
        projects: state.projects.map((project) => ({ ...project, workspaceId: workspace.id })),
        projectMembers: [],
        tasks: [task],
      },
      task.id,
      "2026-05-10T09:10:00.000Z",
    );
    const createdMember = queued.projectMembers.find((member) => member.accountId === "account_wangyuqiao");

    expect(createdMember).toMatchObject({
      projectId: state.projects[0].id,
      workspaceId: workspace.id,
      name: "王昱桥",
      roles: ["executor"],
    });
    expect(queued.tasks.find((item) => item.id === task.id)).toMatchObject({
      primaryExecutorMemberId: createdMember?.id,
      status: "committed",
    });
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
