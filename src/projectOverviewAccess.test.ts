import { describe, expect, it } from "vitest";
import { createInitialState } from "./test/fixtures";
import { deriveProjectDetailModel } from "./projectDetail";
import { buildProjectOverviewCards } from "./projectOverview";
import {
  projectOverviewAccessNow,
  workspaceFixture,
  workspaceMembershipFixture,
} from "./test/projectOverviewAccessFixtures";
import type { Account, AppState, ProjectMember } from "./types";

const projectDetailFilters = {
  query: "",
  status: "all" as const,
  executor: "all" as const,
  priority: "all" as const,
  sort: "status" as const,
};

const accountFixture = (workspaceId: string, id: string, name: string, email: string): Account => ({
  id,
  workspaceId,
  name,
  email,
  createdAt: projectOverviewAccessNow,
  updatedAt: projectOverviewAccessNow,
});

const projectMembersInWorkspace = (
  state: AppState,
  workspaceId: string,
  projectId: string,
  overrides: Partial<ProjectMember> = {},
): ProjectMember[] => state.projectMembers.map((member) => ({
  ...member,
  workspaceId,
  projectId,
  ...overrides,
}));

const deriveDetail = (state: AppState, projectId: string) => deriveProjectDetailModel(state, projectId, projectDetailFilters);

describe("project overview access inheritance", () => {
  it("uses inherited workspace access for project detail member totals", () => {
    const state = createInitialState();
    const workspaceId = "workspace_project_detail_members";
    const workspace = workspaceFixture({
      id: workspaceId,
      name: "详情协作区",
    });
    const projectId = state.projects[0].id;
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: accountFixture(workspaceId, "account_wangshuo", "王硕", "wangshuo"),
        workspace,
        workspaces: [workspace],
        membership: workspaceMembershipFixture({
          id: "membership_wangshuo_detail",
          workspaceId,
          accountId: "account_wangshuo",
          name: "王硕",
          email: "wangshuo",
        }),
        workspaceMemberships: [
          workspaceMembershipFixture({
            id: "membership_owner_detail",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
          }),
          workspaceMembershipFixture({
            id: "membership_wangshuo_detail",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
          }),
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: projectMembersInWorkspace(state, workspaceId, projectId, {
        accountId: "account_owner",
        email: "owner@example.com",
      }),
    };

    const model = deriveDetail(next, projectId);

    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "项目成员")?.value).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "执行者")?.value).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => ({ name: member.name, source: member.source }))).toEqual([
      { name: "项目负责人", source: "project" },
      { name: "王硕", source: "workspace" },
    ]);
  });

  it("shows inherited workspace memberships in project detail when team member rows are unavailable", () => {
    const state = createInitialState();
    const workspaceId = "workspace_detail_membership_only";
    const projectId = state.projects[0].id;
    const workspace = workspaceFixture({
      id: workspaceId,
      name: "后端成员协作区",
    });
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        account: accountFixture(workspaceId, "account_owner", "负责人", "owner@example.com"),
        workspace,
        workspaces: [workspace],
        membership: undefined,
        workspaceMemberships: [
          workspaceMembershipFixture({
            id: "membership_owner_detail_only",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
          }),
          workspaceMembershipFixture({
            id: "membership_wangshuo_detail_only",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
          }),
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: projectMembersInWorkspace(state, workspaceId, projectId, {
        accountId: "account_owner",
        name: "负责人",
        email: "owner@example.com",
      }),
    };

    const model = deriveDetail(next, projectId);

    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "项目成员")?.value).toBe(2);
    expect(model?.memberOverviewStats.find((item) => item.label === "执行者")?.value).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => ({ name: member.name, source: member.source, label: member.sourceLabel }))).toEqual([
      { name: "负责人", source: "project", label: "项目成员" },
      { name: "王硕", source: "workspace", label: "工作区成员" },
    ]);
  });

  it("deduplicates project and workspace member identities across account and email fields", () => {
    const state = createInitialState();
    const workspaceId = "workspace_detail_member_identity";
    const projectId = state.projects[0].id;
    const workspace = workspaceFixture({
      id: workspaceId,
      name: "身份去重协作区",
    });
    const next: AppState = {
      ...state,
      auth: {
        ...state.auth,
        workspace,
        workspaces: [workspace],
        membership: undefined,
        workspaceMemberships: [
          workspaceMembershipFixture({
            id: "membership_owner_identity",
            workspaceId,
            accountId: "account_owner",
            name: "负责人",
            email: "owner@example.com",
            role: "owner",
          }),
          workspaceMembershipFixture({
            id: "membership_wangshuo_identity",
            workspaceId,
            accountId: "account_wangshuo",
            name: "王硕",
            email: "wangshuo",
          }),
        ],
      },
      projects: state.projects.map((project) => ({ ...project, workspaceId })),
      projectMembers: projectMembersInWorkspace(state, workspaceId, projectId, {
        accountId: undefined,
        name: "负责人",
        email: "owner@example.com",
      }),
    };

    const model = deriveDetail(next, projectId);

    expect(buildProjectOverviewCards(next)[0]).toMatchObject({ memberCount: 2 });
    expect(model?.accessibleMemberCount).toBe(2);
    expect(model?.accessibleProjectMembers.map((member) => member.name)).toEqual(["负责人", "王硕"]);
  });
});
