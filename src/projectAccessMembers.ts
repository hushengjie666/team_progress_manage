import { createProjectAccessibleMemberCollector, type ProjectAccessibleMember } from "./projectAccessMemberCollector";
import {
  accountBelongsToWorkspace,
  workspaceMembershipsForState,
  workspacesForState,
} from "./workspaceAccess";
import type {
  AppState,
  ProjectMember,
} from "./types";

export { countProjectAccessibleMembers } from "./projectAccessMemberCount";
export type { ProjectAccessibleMember } from "./projectAccessMemberCollector";

export const buildAccessibleProjectMembers = (
  state: AppState,
  projectMembers: ProjectMember[],
  workspaceId?: string,
) => {
  const collector = createProjectAccessibleMemberCollector();
  const activeWorkspaceMemberships = workspaceId
    ? workspaceMembershipsForState(state).filter((membership) => membership.workspaceId === workspaceId && membership.status === "active")
    : [];

  projectMembers.forEach((member) => {
    collector.addProjectMember(member);
  });

  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) {
      const ownerMembership = activeWorkspaceMemberships.find((membership) => membership.accountId === workspace.ownerAccountId);
      const ownerAccount = state.auth.account?.id === workspace.ownerAccountId ? state.auth.account : undefined;
      collector.addWorkspaceMember(
        {
          accountId: workspace.ownerAccountId,
          email: ownerMembership?.email ?? ownerAccount?.email,
        },
        {
          name: ownerMembership?.name ?? ownerAccount?.name ?? "工作区负责人",
          email: ownerMembership?.email ?? ownerAccount?.email,
          sourceLabel: "工作区负责人",
          workspaceMembership: ownerMembership,
        },
      );
    }
    if (state.auth.account) {
      const currentMembership = activeWorkspaceMemberships.find((membership) => membership.accountId === state.auth.account?.id);
      if (accountBelongsToWorkspace(workspace, state.auth.account, activeWorkspaceMemberships, workspaceId)) {
        collector.addWorkspaceMember(
          {
            accountId: state.auth.account.id,
            email: currentMembership?.email ?? state.auth.account.email,
          },
          {
            name: currentMembership?.name ?? state.auth.account.name,
            email: currentMembership?.email ?? state.auth.account.email,
            sourceLabel: currentMembership?.role === "owner" || workspace?.ownerAccountId === state.auth.account.id ? "工作区负责人" : "工作区成员",
            workspaceMembership: currentMembership,
          },
        );
      }
    }
    activeWorkspaceMemberships.forEach((membership) => {
      collector.addWorkspaceMember(
        membership,
        {
          name: membership.name || membership.email,
          email: membership.email,
          sourceLabel: membership.role === "owner" ? "工作区负责人" : "工作区成员",
          workspaceMembership: membership,
        },
      );
    });
  }

  return collector.members();
};
