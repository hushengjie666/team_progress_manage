import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { buildProjectOverviewCards } from "./projectOverview";
import type { AppState, WorkspaceMembership } from "./types";
import {
  projectOverviewAccessNow,
  workspaceFixture,
  workspaceMembershipFixture,
} from "./test/projectOverviewAccessFixtures";

describe("project overview member counts", () => {
  it("counts everyone with project access in project overview cards", () => {
    const state = createInitialState();
    const workspaceId = "workspace_shared_access_count";
    const workspace = workspaceFixture({ id: workspaceId });
    const workspaceMemberships: WorkspaceMembership[] = [
      workspaceMembershipFixture({
        id: "membership_owner_access_count",
        workspaceId,
        accountId: "account_owner",
        name: "项目负责人",
        email: "owner@example.com",
        role: "owner",
      }),
      workspaceMembershipFixture({
        id: "membership_teammate_access_count",
        workspaceId,
        accountId: "account_teammate",
        name: "协作成员",
        email: "teammate@example.com",
      }),
      workspaceMembershipFixture({
        id: "membership_disabled_access_count",
        workspaceId,
        accountId: "account_disabled",
        name: "停用成员",
        email: "disabled@example.com",
        status: "disabled",
      }),
    ];
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace,
        workspaces: [workspace],
        workspaceMemberships,
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: [
        ...state.projectMembers,
        {
          id: "member_project_only_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          name: "项目单独成员",
          email: "contractor@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
        {
          id: "member_duplicate_workspace_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          accountId: "account_teammate",
          name: "协作成员",
          email: "teammate@example.com",
          roles: ["executor"],
          status: "active",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
        {
          id: "member_disabled_project_access_count",
          workspaceId,
          projectId: state.projects[0].id,
          name: "停用项目成员",
          email: "project-disabled@example.com",
          roles: ["executor"],
          status: "disabled",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
      ],
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 3,
      workspaceName: "协作区",
    });
  });

  it("uses workspace memberships for project access counts", () => {
    const state = createInitialState();
    const workspaceId = "workspace_shared_member_count";
    const workspace = workspaceFixture({ id: workspaceId });
    const workspaceMemberships: WorkspaceMembership[] = [
      workspaceMembershipFixture({
        id: "membership_owner_count",
        workspaceId,
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
        role: "owner",
      }),
      workspaceMembershipFixture({
        id: "membership_teammate_count",
        workspaceId,
        accountId: "account_teammate",
        name: "协作成员",
        email: "teammate@example.com",
      }),
      workspaceMembershipFixture({
        id: "membership_disabled_count",
        workspaceId,
        accountId: "account_disabled",
        name: "停用成员",
        email: "disabled@example.com",
        status: "disabled",
      }),
    ];
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace,
        workspaces: [workspace],
        workspaceMemberships,
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: state.projectMembers.map((member) => ({
        ...member,
        workspaceId,
        accountId: "account_owner",
        email: "owner@example.com",
      })),
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "协作区",
    });
  });

  it("counts the workspace owner and active workspace members on project cards", () => {
    const state = createInitialState();
    const workspaceId = "workspace_owner_fallback";
    const workspace = workspaceFixture({
      id: workspaceId,
      name: "旧数据协作区",
    });
    const membership = workspaceMembershipFixture({
      id: "membership_wangshuo_owner_fallback",
      workspaceId,
      accountId: "account_wangshuo",
      name: "王硕",
      email: "wangshuo",
    });
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: {
          id: "account_wangshuo",
          workspaceId,
          name: "王硕",
          email: "wangshuo",
          createdAt: projectOverviewAccessNow,
          updatedAt: projectOverviewAccessNow,
        },
        workspace,
        workspaces: [workspace],
        membership,
        workspaceMemberships: [membership],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: [],
    };

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({
      memberCount: 2,
      workspaceName: "旧数据协作区",
    });
  });
});
