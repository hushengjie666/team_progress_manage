import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import { bindAccountToMembers } from "./authModel";
import {
  filterTodayCommittedTasksForMember,
} from "./projectOverview";
import { createInitialState } from "./test/fixtures";
import { createProjectInState } from "./teamProgress";
import type { ProjectMember, Task } from "./types";

describe("authenticated account member binding", () => {
  it("keeps focus tasks visible after login binds same-email executor memberships", () => {
    const state = createInitialState();
    const firstProjectId = state.projects[0].id;
    const withSecondProject = createProjectInState(
      state,
      "图像识别",
      "第二项目",
      "2026-05-10T09:00:00.000Z",
      (prefix) => `${prefix}_login_bind`,
    );
    const secondMember = withSecondProject.projectMembers.find((member) => member.projectId === "project_login_bind")!;
    const todayPlan = getTodayPlan(withSecondProject);
    const firstTask = {
      ...state.tasks[0],
      id: "login_bind_first",
      projectId: firstProjectId,
      project: "TimeManage",
      primaryExecutorMemberId: undefined,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const secondTask = {
      ...state.tasks[1],
      id: "login_bind_second",
      projectId: "project_login_bind",
      project: "图像识别",
      primaryExecutorMemberId: secondMember.id,
      collaboratorMemberIds: [],
      status: "committed" as const,
    };
    const loggedIn = bindAccountToMembers(
      {
        ...withSecondProject,
        projectMembers: withSecondProject.projectMembers.map((member) =>
          member.projectId === "project_login_bind"
            ? {
                ...member,
                accountId: undefined,
                email: "owner@example.com",
                roles: ["executor"],
              }
            : member,
        ),
        tasks: [firstTask, secondTask],
        dailyPlans: [{ ...todayPlan, committedTaskIds: [firstTask.id, secondTask.id] }],
      },
      {
        status: "authenticated",
        token: "login_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );
    const currentMember = loggedIn.projectMembers.find(
      (member) => member.projectId === "project_login_bind" && member.accountId === "account_owner",
    );
    const committedTasks = loggedIn.dailyPlans[0].committedTaskIds
      .map((id) => loggedIn.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));

    expect(loggedIn.projectMembers.find((member) => member.id === secondMember.id)).toMatchObject({
      accountId: "account_owner",
    });
    expect(filterTodayCommittedTasksForMember(loggedIn, committedTasks, currentMember).map((task) => task.id)).toEqual([secondTask.id]);
  });

  it("does not bind a stale selected project member to a different authenticated account", () => {
    const state = createInitialState();
    const staleMember: ProjectMember = {
      ...state.projectMembers[0],
      id: "member_stale_selected",
      accountId: undefined,
      name: "王硕",
      email: undefined,
      roles: ["project_owner", "executor"],
    };
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        projectMembers: [staleMember, ...state.projectMembers],
      },
      {
        status: "authenticated",
        token: "stale_bind_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_hushengjie",
          workspaceId: "workspace_test",
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.projectMembers.find((member) => member.id === staleMember.id)?.accountId).toBeUndefined();
    expect(loggedIn.projectMembers.some((member) => member.accountId === "account_hushengjie")).toBe(false);
  });

  it("does not create a project member just because an account logged in", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        projectMembers: [],
      },
      {
        status: "authenticated",
        token: "no_member_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_no_member",
          workspaceId: "workspace_test",
          name: "仅登录账号",
          email: "account-only@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.projectMembers).toEqual([]);
  });

  it("sets backend status when binding an authenticated account", () => {
    const state = createInitialState();
    const loggedIn = bindAccountToMembers(
      {
        ...state,
        backend: {
          ...state.backend,
          status: "error",
        },
      },
      {
        status: "authenticated",
        token: "retry_clear_token",
        bootstrapped: true,
        message: "已登录",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: "2026-05-10T09:00:00.000Z",
          updatedAt: "2026-05-10T09:00:00.000Z",
        },
      },
      "2026-05-10T09:10:00.000Z",
    );

    expect(loggedIn.backend).toMatchObject({
      status: "idle",
    });
  });
});
