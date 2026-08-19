import type { WorkspaceAccountRuntime, WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";
import { createWorkspaceInvitationCommands } from "./workspaceInvitationCommands";
import { createWorkspaceInvitationRefreshers } from "./workspaceInvitationRefresh";

type WorkspaceInvitationRuntime = Pick<
  WorkspaceAccountRuntime,
  | "refreshWorkspaceInvitations"
  | "refreshProjectInvitations"
  | "inviteWorkspaceMember"
  | "inviteProjectMember"
  | "acceptPendingWorkspaceInvitation"
  | "acceptPendingProjectInvitation"
  | "deletePendingWorkspaceInvitation"
  | "deletePendingProjectInvitation"
>;

type WorkspaceInvitationRuntimeOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setState" | "setToast" | "setWorkspaceInvitations" | "setProjectInvitations" | "getWorkspaceInvitations" | "getProjectInvitations"
>;

export function createWorkspaceInvitationRuntime({
  getState,
  setState,
  setToast,
  setWorkspaceInvitations,
  setProjectInvitations,
  getWorkspaceInvitations,
  getProjectInvitations,
}: WorkspaceInvitationRuntimeOptions): WorkspaceInvitationRuntime {
  const refreshers = createWorkspaceInvitationRefreshers({
    getState,
    setWorkspaceInvitations,
    setProjectInvitations,
  });
  const commands = createWorkspaceInvitationCommands({
    getState,
    setState,
    setToast,
    setWorkspaceInvitations,
    setProjectInvitations,
    getWorkspaceInvitations,
    getProjectInvitations,
    ...refreshers,
  });

  return {
    ...refreshers,
    ...commands,
  };
}
