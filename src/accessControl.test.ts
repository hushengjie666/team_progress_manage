import { describe, expect, it } from "vitest";
import { createInitialState, iso } from "./test/fixtures";
import {
  accessibleProjectIdsForAccount,
  buildAccessibleProjectMembers,
  countActiveWorkspaceMembers,
  countProjectAccessibleMembers,
  visibleProjectsForAccount,
} from "./accessControl";
import type { AppState, Project, ProjectMember, Workspace, WorkspaceMembership } from "./types";

const now = iso("2026-05-10T08:00:00Z");

const workspace = (id: string, name: string, ownerAccountId = "account_owner"): Workspace => ({
  id,
  name,
  type: "shared",
  ownerAccountId,
  createdAt: now,
  updatedAt: now,
});

const project = (id: string, name: string, workspaceId: string): Project => ({
  id,
  workspaceId,
  name,
  description: "",
  defaultExpectedStartHours: 24,
  taskStageMode: "regular",
  createdAt: now,
  updatedAt: now,
});

const membership = (overrides: Pick<WorkspaceMembership, "id" | "workspaceId" | "accountId"> & Partial<WorkspaceMembership>): WorkspaceMembership => ({
  id: overrides.id,
  workspaceId: overrides.workspaceId,
  accountId: overrides.accountId,
  name: overrides.name ?? overrides.accountId,
  email: overrides.email ?? `${overrides.accountId}@example.com`,
  role: overrides.role ?? "member",
  status: overrides.status ?? "active",
  createdAt: now,
  updatedAt: now,
});

const projectMember = (overrides: Pick<ProjectMember, "id" | "projectId" | "accountId"> & Partial<ProjectMember>): ProjectMember => {
  const accountId = overrides.accountId ?? "account_unknown";
  return {
    id: overrides.id,
    workspaceId: overrides.workspaceId,
    projectId: overrides.projectId,
    accountId,
    name: overrides.name ?? accountId,
    email: overrides.email ?? `${accountId}@example.com`,
    roles: overrides.roles ?? ["executor"],
    status: overrides.status ?? "active",
    createdAt: now,
    updatedAt: now,
  };
};

const accessState = (): AppState => {
  const base = createInitialState();
  const privateWorkspace = { ...workspace("workspace_private", "私人区", "account_invitee"), type: "private" as const };
  const sharedWorkspace = workspace("workspace_shared", "协作区");
  const visibleProject = project("project_visible", "受邀项目", sharedWorkspace.id);
  const hiddenProject = project("project_hidden", "隐藏项目", sharedWorkspace.id);
  return {
    ...base,
    auth: {
      ...base.auth,
      status: "authenticated",
      account: {
        id: "account_invitee",
        workspaceId: privateWorkspace.id,
        name: "项目成员",
        email: "invitee@example.com",
        createdAt: now,
        updatedAt: now,
      },
      workspace: privateWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      workspaceMemberships: [
        membership({
          id: "membership_private",
          workspaceId: privateWorkspace.id,
          accountId: "account_invitee",
          role: "owner",
        }),
      ],
    },
    projects: [visibleProject, hiddenProject],
    projectMembers: [
      projectMember({
        id: "member_project_only",
        workspaceId: sharedWorkspace.id,
        projectId: visibleProject.id,
        accountId: "account_invitee",
        name: "项目成员",
        email: "invitee@example.com",
      }),
    ],
    tasks: [],
  };
};

describe("access control", () => {
  it("lets a project-only member see only the invited project", () => {
    const state = accessState();

    expect([...accessibleProjectIdsForAccount(state, state.auth.account)].sort()).toEqual(["project_visible"]);
    expect(visibleProjectsForAccount(state).map((item) => item.id)).toEqual(["project_visible"]);
  });

  it("lets an active workspace member see every project in that workspace", () => {
    const state = {
      ...accessState(),
      auth: {
        ...accessState().auth,
        workspaceMemberships: [
          membership({
            id: "membership_shared",
            workspaceId: "workspace_shared",
            accountId: "account_invitee",
            role: "member",
          }),
        ],
      },
      projectMembers: [],
    };

    expect([...accessibleProjectIdsForAccount(state, state.auth.account)].sort()).toEqual(["project_hidden", "project_visible"]);
  });

  it("removes disabled workspace memberships from visibility and member counts", () => {
    const state = {
      ...accessState(),
      auth: {
        ...accessState().auth,
        workspaceMemberships: [
          membership({
            id: "membership_shared_disabled",
            workspaceId: "workspace_shared",
            accountId: "account_invitee",
            status: "disabled",
          }),
        ],
      },
      projectMembers: [],
    };

    expect([...accessibleProjectIdsForAccount(state, state.auth.account)]).toEqual([]);
    expect(countActiveWorkspaceMembers("workspace_shared", state.auth.workspaceMemberships ?? [], state.auth.account)).toBe(0);
  });

  it("builds project people from workspace memberships plus project-only members", () => {
    const state = {
      ...accessState(),
      auth: {
        ...accessState().auth,
        workspaceMemberships: [
          membership({
            id: "membership_owner",
            workspaceId: "workspace_shared",
            accountId: "account_owner",
            role: "owner",
            name: "负责人",
          }),
          membership({
            id: "membership_teammate",
            workspaceId: "workspace_shared",
            accountId: "account_teammate",
            name: "协作成员",
          }),
        ],
      },
    };

    const people = buildAccessibleProjectMembers(state, state.projectMembers, "workspace_shared");

    expect(people.map((item) => item.name)).toEqual(["项目成员", "负责人", "协作成员"]);
    expect(countProjectAccessibleMembers(state, state.projects[0], "workspace_shared")).toBe(3);
  });
});
