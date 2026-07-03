import type { AppProjectActionsRuntime } from "./appProjectActionsRuntime";
import type { AppAuthenticatedShellProps } from "./components/AppAuthenticatedShellTypes";
import type { AppState } from "./types";
import type { WorkspaceAccountRuntime } from "./workspaceAccountRuntime";

export const buildWorkspaceAccountShellActions = (
  runtime: WorkspaceAccountRuntime,
): AppAuthenticatedShellProps["workspaceAccountActions"] => ({
  refreshWorkspaceInvitations: runtime.refreshWorkspaceInvitations,
  refreshProjectInvitations: runtime.refreshProjectInvitations,
  inviteWorkspaceMember: runtime.inviteWorkspaceMember,
  updateWorkspace: runtime.updateWorkspace,
  updateWorkspaceMembership: runtime.updateWorkspaceMembership,
  acceptPendingWorkspaceInvitation: runtime.acceptPendingWorkspaceInvitation,
  acceptPendingProjectInvitation: runtime.acceptPendingProjectInvitation,
  createPlatformAccount: runtime.createPlatformAccount,
  updatePlatformAccountProfile: runtime.updatePlatformAccountProfile,
  updatePlatformAccountPassword: runtime.updatePlatformAccountPassword,
  disablePlatformAccount: runtime.disablePlatformAccount,
});

export function createProjectMemberInviteGuard({
  getState,
  fallbackState,
  projectActions,
  inviteProjectMember,
  setToast,
}: {
  getState: () => AppState | null;
  fallbackState: AppState;
  projectActions: Pick<AppProjectActionsRuntime, "canManageProjectMembersForProject">;
  inviteProjectMember: WorkspaceAccountRuntime["inviteProjectMember"];
  setToast: (message: string) => void;
}): AppAuthenticatedShellProps["inviteProjectMember"] {
  return (input) => {
    const source = getState() ?? fallbackState;
    if (!projectActions.canManageProjectMembersForProject(source, input.projectId)) {
      setToast("只有工作区管理员或项目负责人可以维护项目成员");
      return;
    }
    inviteProjectMember(input);
  };
}
