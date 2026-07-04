import {
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
} from "./teamBackend";
import { tokenForState } from "./workspaceAccountMetadata";
import type { WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";

type WorkspaceInvitationRefreshOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setWorkspaceInvitations" | "setProjectInvitations"
>;

export function createWorkspaceInvitationRefreshers({
  getState,
  setWorkspaceInvitations,
  setProjectInvitations,
}: WorkspaceInvitationRefreshOptions) {
  const refreshWorkspaceInvitations = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token) {
      setWorkspaceInvitations([]);
      return [];
    }
    const invitations = await fetchWorkspaceInvitations(source.backend, token);
    setWorkspaceInvitations(invitations);
    return invitations;
  };

  const refreshProjectInvitations = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token) {
      setProjectInvitations([]);
      return [];
    }
    const invitations = await fetchProjectInvitations(source.backend, token);
    setProjectInvitations(invitations);
    return invitations;
  };

  return {
    refreshWorkspaceInvitations,
    refreshProjectInvitations,
  };
}
