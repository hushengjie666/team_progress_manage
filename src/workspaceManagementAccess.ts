import type { AppState } from "./types";
import {
  workspaceMembershipsForState,
  workspacesForState,
} from "./workspaceStateAccess";

export const canManageWorkspace = (state: AppState, workspaceId: string, account = state.auth.account) => {
  if (!account?.id) return false;
  const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
  if (workspace?.ownerAccountId === account.id) return true;
  return workspaceMembershipsForState(state).some(
    (membership) =>
      membership.workspaceId === workspaceId &&
      membership.accountId === account.id &&
      membership.status === "active" &&
      (membership.role === "owner" || membership.role === "admin"),
  );
};
