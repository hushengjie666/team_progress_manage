import { addMemberAccessIdentity } from "./accessIdentity";
import {
  workspaceMembershipsForState,
  workspacesForState,
} from "./workspaceAccess";
import type { AppState, Project } from "./types";

export const countProjectAccessibleMembers = (state: AppState, project: Project, workspaceId?: string) => {
  const identities = new Set<string>();
  const identityAliasToKey = new Map<string, string>();
  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) addMemberAccessIdentity(identities, identityAliasToKey, { accountId: workspace.ownerAccountId });
    const activeMemberships = workspaceMembershipsForState(state)
      .filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
    activeMemberships.forEach((membership) => addMemberAccessIdentity(identities, identityAliasToKey, membership));
  }
  state.projectMembers
    .filter((member) => member.projectId === project.id && member.status !== "disabled")
    .forEach((member) => addMemberAccessIdentity(identities, identityAliasToKey, member));
  return identities.size;
};
