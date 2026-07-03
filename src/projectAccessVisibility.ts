import {
  projectMemberIdentityIds,
  resolveCurrentMember,
} from "./memberIdentity";
import {
  activeWorkspaceIdsForAccount,
  canManageWorkspace,
  workspaceIdForProject,
} from "./workspaceAccess";
import type {
  Account,
  AppState,
  ProjectMember,
} from "./types";
import { accountIdentity, projectMemberMatchesIdentity } from "./projectAccessIdentity";

const accountProjectMemberIds = (state: AppState, account?: Account, currentMember?: ProjectMember) => {
  if (currentMember) return projectMemberIdentityIds(state, currentMember);
  if (!account) return projectMemberIdentityIds(state, resolveCurrentMember(state));
  return new Set(
    state.projectMembers
      .filter((member) => member.status !== "disabled" && projectMemberMatchesIdentity(member, accountIdentity(account)))
      .map((member) => member.id),
  );
};

export const accessibleProjectIdsForAccount = (state: AppState, account?: Account, currentMember?: ProjectMember) => {
  const memberIds = accountProjectMemberIds(state, account, currentMember);
  const workspaceIds = activeWorkspaceIdsForAccount(state, account);
  const projectIds = new Set<string>();

  state.projectMembers
    .filter((member) => member.status !== "disabled" && memberIds.has(member.id))
    .forEach((member) => projectIds.add(member.projectId));

  state.projects
    .filter((project) => {
      const workspaceId = workspaceIdForProject(state, project);
      return workspaceId ? workspaceIds.has(workspaceId) : false;
    })
    .forEach((project) => projectIds.add(project.id));

  return projectIds;
};

export const accessibleProjectIdsForCurrentUser = (state: AppState, currentMember?: ProjectMember) =>
  accessibleProjectIdsForAccount(state, state.auth.account, currentMember);

export const visibleProjectsForAccount = (state: AppState, account = state.auth.account) => {
  if (!account) return state.projects;
  const accessibleProjectIds = accessibleProjectIdsForAccount(state, account);
  return state.projects.filter((project) => accessibleProjectIds.has(project.id));
};

export const visibleTasksForAccount = (state: AppState, account = state.auth.account) => {
  const accessibleProjectIds = accessibleProjectIdsForAccount(state, account);
  return state.tasks.filter((task) => accessibleProjectIds.has(task.projectId));
};

export const resolveProjectMemberForAccount = (state: AppState, projectId: string, account = state.auth.account) => {
  if (!account) return undefined;
  return state.projectMembers.find(
    (member) => member.projectId === projectId && member.status !== "disabled" && projectMemberMatchesIdentity(member, accountIdentity(account)),
  );
};

export const canManageProjectMembers = (state: AppState, projectId: string, account = state.auth.account) => {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project ? workspaceIdForProject(state, project) : undefined;
  if (workspaceId && canManageWorkspace(state, workspaceId, account)) return true;
  if (!account) {
    const currentMember = resolveCurrentMember(state);
    return Boolean(
      currentMember?.projectId === projectId &&
      currentMember.status !== "disabled" &&
      currentMember.roles.includes("project_owner"),
    );
  }
  return Boolean(resolveProjectMemberForAccount(state, projectId, account)?.roles.includes("project_owner"));
};

export const canReviewProjectTasks = (state: AppState, projectId: string, account = state.auth.account) =>
  canManageProjectMembers(state, projectId, account);
