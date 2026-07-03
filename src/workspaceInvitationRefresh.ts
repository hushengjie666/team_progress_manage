import {
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
} from "./sync";
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
    const invitations = await fetchWorkspaceInvitations(source.sync, token);
    setWorkspaceInvitations(invitations);
    return invitations;
  };

  const refreshProjectInvitations = async (source = getState()) => {
    const token = tokenForState(source);
    if (!source || !token) {
      setProjectInvitations([]);
      return [];
    }
    const invitations = await fetchProjectInvitations(source.sync, token);
    setProjectInvitations(invitations);
    return invitations;
  };

  return {
    refreshWorkspaceInvitations,
    refreshProjectInvitations,
  };
}
