import { describe, expect, it } from "vitest";
import { createInitialState } from "../seed";
import {
  memberStatusDailyPlan,
  memberStatusMember,
  memberStatusProject,
  memberStatusTask,
  memberStatusTimestamp,
  memberStatusWorkspaceMembership,
} from "../test/memberStatusFixtures";
import {
  buildMemberStatusColumns,
} from "./MemberStatusView";

describe("member status access filtering", () => {
  it("only shows other members' today tasks from projects the current account can access", () => {
    const state = createInitialState();
    const visibleWorkspace = {
      id: "workspace_visible",
      name: "消毒工作区",
      type: "shared" as const,
      createdAt: memberStatusTimestamp,
      updatedAt: memberStatusTimestamp,
    };
    const hiddenWorkspace = {
      id: "workspace_hidden",
      name: "隐藏工作区",
      type: "shared" as const,
      createdAt: memberStatusTimestamp,
      updatedAt: memberStatusTimestamp,
    };
    const visibleProject = memberStatusProject("project_visible", "消毒中心", { workspaceId: visibleWorkspace.id });
    const hiddenProject = memberStatusProject("project_hidden", "隐藏项目", { workspaceId: hiddenWorkspace.id });
    const currentMembership = memberStatusWorkspaceMembership({
      id: "workspace_member_current",
      workspaceId: visibleWorkspace.id,
      accountId: "account_current",
      name: "胡圣杰",
      email: "hushengjie@example.com",
      role: "owner",
    });
    const otherVisibleMembership = memberStatusWorkspaceMembership({
      id: "workspace_member_other",
      workspaceId: visibleWorkspace.id,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo@example.com",
    });
    const visibleMember = memberStatusMember({
      id: "member_wangshuo_visible",
      projectId: visibleProject.id,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    });
    const hiddenMember = memberStatusMember({
      id: "member_wangshuo_hidden",
      projectId: hiddenProject.id,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo@example.com",
      roles: ["executor"],
    });
    const visibleTask = memberStatusTask({
      id: "task_visible",
      title: "处理消毒中心任务",
      projectId: visibleProject.id,
      project: visibleProject.name,
      primaryExecutorMemberId: visibleMember.id,
    });
    const hiddenTask = memberStatusTask({
      id: "task_hidden",
      title: "处理隐藏项目任务",
      projectId: hiddenProject.id,
      project: hiddenProject.name,
      primaryExecutorMemberId: hiddenMember.id,
    });

    const columns = buildMemberStatusColumns({
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        token: "token",
        account: {
          id: "account_current",
          workspaceId: visibleWorkspace.id,
          name: "胡圣杰",
          email: "hushengjie@example.com",
          createdAt: memberStatusTimestamp,
          updatedAt: memberStatusTimestamp,
        },
        workspace: visibleWorkspace,
        membership: currentMembership,
        workspaces: [visibleWorkspace],
        workspaceMemberships: [currentMembership, otherVisibleMembership],
      },
      projects: [visibleProject, hiddenProject],
      projectMembers: [visibleMember, hiddenMember],
      tasks: [visibleTask, hiddenTask],
      dailyPlans: [memberStatusDailyPlan([visibleTask.id, hiddenTask.id])],
    });

    const wangshuo = columns.find((column) => column.name === "王硕");

    expect(wangshuo?.displayedTasks.map((item) => item.id)).toEqual(["task_visible"]);
    expect(wangshuo?.projectTaskGroups.map((group) => group.projectName)).toEqual(["消毒中心"]);
    expect(wangshuo?.projectTaskGroups.map((group) => group.workspaceName)).toEqual(["消毒工作区"]);
  });

  it("uses visible workspace team members when ordinary members cannot load workspace membership details", () => {
    const state = createInitialState();
    const privateWorkspace = {
      id: "workspace_private_wangshuo",
      name: "王硕的私人工作区",
      type: "private" as const,
      createdAt: memberStatusTimestamp,
      updatedAt: memberStatusTimestamp,
    };
    const sharedWorkspace = {
      id: "workspace_shared_disinfection",
      name: "宁波团队出击",
      type: "shared" as const,
      createdAt: memberStatusTimestamp,
      updatedAt: memberStatusTimestamp,
    };
    const hiddenWorkspace = {
      id: "workspace_hidden",
      name: "隐藏工作区",
      type: "shared" as const,
      createdAt: memberStatusTimestamp,
      updatedAt: memberStatusTimestamp,
    };
    const visibleProject = memberStatusProject("project_disinfection", "消毒中心", { workspaceId: sharedWorkspace.id });

    const columns = buildMemberStatusColumns({
      ...state,
      auth: {
        ...state.auth,
        status: "authenticated",
        token: "token",
        account: {
          id: "account_wangshuo",
          workspaceId: privateWorkspace.id,
          name: "王硕",
          email: "wangshuo@example.com",
          createdAt: memberStatusTimestamp,
          updatedAt: memberStatusTimestamp,
        },
        workspace: privateWorkspace,
        workspaces: [privateWorkspace, sharedWorkspace],
        workspaceMemberships: [
          memberStatusWorkspaceMembership({
            id: "membership_hushengjie",
            workspaceId: sharedWorkspace.id,
            accountId: "account_hushengjie",
            name: "胡圣杰",
            email: "hushengjie@example.com",
          }),
          memberStatusWorkspaceMembership({
            id: "membership_wangshuo",
            workspaceId: sharedWorkspace.id,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo@example.com",
          }),
          memberStatusWorkspaceMembership({
            id: "membership_hidden",
            workspaceId: hiddenWorkspace.id,
            accountId: "account_hidden",
            name: "隐藏成员",
            email: "hidden@example.com",
          }),
        ],
      },
      projects: [visibleProject],
      projectMembers: [],
      tasks: [],
      dailyPlans: [memberStatusDailyPlan([])],
    });

    expect(columns.map((column) => column.name)).toEqual(["胡圣杰", "王硕"]);
  });
});
