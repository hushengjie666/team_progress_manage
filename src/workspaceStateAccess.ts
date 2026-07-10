import type { AppState, Project } from "./types";

export const workspaceMembershipsForState = (state: AppState) => {
  const memberships = state.auth.workspaceMemberships ?? [];
  const currentMembership = state.auth.membership;
  if (
    !currentMembership ||
    memberships.some(
      (membership) =>
        membership.id === currentMembership.id ||
        (membership.workspaceId === currentMembership.workspaceId && membership.accountId === currentMembership.accountId),
    )
  ) {
    return memberships;
  }
  return [...memberships, currentMembership];
};

export const workspacesForState = (state: AppState) =>
  state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);

export const workspaceForProject = (state: AppState, project: Project) =>
  project.workspaceId
    ? workspacesForState(state).find((item) => item.id === project.workspaceId) ??
      (state.auth.workspace?.id === project.workspaceId ? state.auth.workspace : undefined)
    : state.auth.workspace;

export const workspaceIdForProject = (state: AppState, project: Project) =>
  project.workspaceId ?? workspaceForProject(state, project)?.id;
