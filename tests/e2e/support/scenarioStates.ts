import type { AppState } from "../../../src/types";
import { authenticatedState } from "./authenticatedState";
import type { MockProjectInvitation } from "./mockTypes";

export const projectInviteeScenario = () => {
  const ownerState = authenticatedState();
  const now = new Date().toISOString();
  const privateWorkspace = {
    id: "workspace_private_account_invitee",
    name: "受邀成员私人区",
    type: "private" as const,
    ownerAccountId: "account_invitee",
    createdAt: now,
    updatedAt: now,
  };
  const sharedWorkspace = ownerState.auth.workspaces?.find((workspace) => workspace.id === "workspace_e2e");
  if (!sharedWorkspace) throw new Error("missing shared workspace fixture");
  const hiddenProject = {
    ...ownerState.projects[0],
    id: "project_hidden_workspace_only",
    name: "E2E 工作区隐藏项目",
    description: "只有工作区成员可见，项目邀请成员不应看到。",
    sortOrder: 99,
    updatedAt: now,
  };
  const hiddenTask = {
    ...ownerState.tasks[0],
    id: "task_hidden_workspace_only",
    projectId: hiddenProject.id,
    project: hiddenProject.name,
    title: "E2E 隐藏项目任务",
    sortOrder: 99,
    updatedAt: now,
  };
  const initialState: AppState = {
    ...ownerState,
    auth: {
      ...ownerState.auth,
      account: {
        id: "account_invitee",
        workspaceId: privateWorkspace.id,
        name: "受邀成员",
        email: "invitee@example.com",
        createdAt: now,
        updatedAt: now,
      },
      workspace: privateWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
      membership: {
        id: "membership_workspace_private_account_invitee",
        workspaceId: privateWorkspace.id,
        accountId: "account_invitee",
        name: "受邀成员",
        email: "invitee@example.com",
        role: "owner",
        status: "active",
        createdAt: now,
        updatedAt: now,
      },
      workspaceMemberships: [
        {
          id: "membership_workspace_private_account_invitee",
          workspaceId: privateWorkspace.id,
          accountId: "account_invitee",
          name: "受邀成员",
          email: "invitee@example.com",
          role: "owner",
          status: "active",
          createdAt: now,
          updatedAt: now,
        },
      ],
    },
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    updatedAt: now,
  };
  const acceptedProjectMember = {
    id: "member_invitee_project_starter",
    workspaceId: sharedWorkspace.id,
    projectId: "project_starter",
    accountId: "account_invitee",
    name: "受邀成员",
    email: "invitee@example.com",
    roles: ["executor" as const],
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };
  const acceptedState: AppState = {
    ...initialState,
    auth: {
      ...initialState.auth,
      workspace: sharedWorkspace,
      workspaces: [privateWorkspace, sharedWorkspace],
    },
    projects: ownerState.projects,
    projectMembers: [
      ...ownerState.projectMembers.map((member) => ({
        ...member,
        workspaceId: sharedWorkspace.id,
        accountId: "account_owner",
        email: "owner@example.com",
      })),
      acceptedProjectMember,
    ],
    tasks: ownerState.tasks,
    dailyPlans: ownerState.dailyPlans,
    updatedAt: now,
  };
  const fullWorkspaceState: AppState = {
    ...acceptedState,
    projects: [...acceptedState.projects, hiddenProject],
    tasks: [...acceptedState.tasks, hiddenTask],
    dailyPlans: acceptedState.dailyPlans.map((plan) => ({
      ...plan,
      committedTaskIds: [...plan.committedTaskIds, hiddenTask.id],
    })),
  };
  const invitation: MockProjectInvitation = {
    id: "project_invitation_invitee_starter",
    workspace_id: sharedWorkspace.id,
    workspace_name: sharedWorkspace.name,
    project_id: "project_starter",
    project_name: "TimeManage 团队进度",
    inviter_account_id: "account_owner",
    inviter_name: "项目负责人",
    inviter_email: "owner@example.com",
    invitee_account_id: "account_invitee",
    invitee_email: "invitee@example.com",
    roles: ["executor"],
    status: "pending",
    created_at: now,
    updated_at: now,
  };
  return { initialState, fullWorkspaceState, invitation };
};

export const workspaceMemberState = () => {
  const state = authenticatedState();
  const sharedWorkspace = state.auth.workspaces?.find((workspace) => workspace.id === "workspace_e2e");
  const membership = state.auth.workspaceMemberships?.find((item) => item.accountId === "account_wangshuo");
  if (!sharedWorkspace || !membership) throw new Error("missing workspace member fixture");
  return {
    ...state,
    auth: {
      ...state.auth,
      account: {
        id: "account_wangshuo",
        workspaceId: sharedWorkspace.id,
        name: "王硕",
        email: "wangshuo",
        createdAt: membership.createdAt,
        updatedAt: membership.updatedAt,
      },
      workspace: sharedWorkspace,
      membership,
    },
    backend: {
      ...state.backend,
      username: "wangshuo",
    },
  };
};

export const projectMoveState = (): AppState => {
  const state = authenticatedState();
  const now = new Date().toISOString();
  const targetWorkspace = {
    id: "workspace_e2e_target",
    name: "E2E 目标工作区",
    type: "shared" as const,
    ownerAccountId: "account_owner",
    createdAt: now,
    updatedAt: now,
  };
  const targetMembership = {
    id: "membership_workspace_e2e_target_account_owner",
    workspaceId: targetWorkspace.id,
    accountId: "account_owner",
    name: "项目负责人",
    email: "owner@example.com",
    role: "owner" as const,
    status: "active" as const,
    createdAt: now,
    updatedAt: now,
  };

  return {
    ...state,
    auth: {
      ...state.auth,
      workspaces: [...(state.auth.workspaces ?? []), targetWorkspace],
      workspaceMemberships: [...(state.auth.workspaceMemberships ?? []), targetMembership],
    },
    projects: state.projects.map((project) =>
      project.id === "project_starter" ? { ...project, workspaceId: "workspace_e2e" } : project,
    ),
    projectMembers: state.projectMembers.map((member) =>
      member.projectId === "project_starter" ? { ...member, workspaceId: "workspace_e2e" } : member,
    ),
    tasks: state.tasks.map((task) =>
      task.projectId === "project_starter" ? { ...task, workspaceId: "workspace_e2e" } : task,
    ),
  };
};
