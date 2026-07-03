import {
  fetchPlatformAccounts,
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
} from "./sync";
import type { Account, AppState } from "./types";
import type { WorkspaceAccountMetadata } from "./workspaceAccountTypes";

export const tokenForState = (state?: AppState | null) => state?.auth.token ?? state?.sync.token;

export function isSuperAdminAccount(account?: Account) {
  return account?.id === "account_admin" || account?.email?.trim().toLowerCase() === "admin";
}

export async function loadWorkspaceAccountMetadata(state: AppState, token = tokenForState(state)): Promise<WorkspaceAccountMetadata> {
  if (!token) {
    return { platformAccounts: [], workspaceInvitations: [], projectInvitations: [] };
  }

  const [platformAccounts, workspaceInvitations, projectInvitations] = await Promise.all([
    isSuperAdminAccount(state.auth.account)
      ? fetchPlatformAccounts(state.sync, token).catch(() => [])
      : Promise.resolve([]),
    fetchWorkspaceInvitations(state.sync, token),
    fetchProjectInvitations(state.sync, token),
  ]);

  return { platformAccounts, workspaceInvitations, projectInvitations };
}
