import {
  fetchPlatformAccounts,
  fetchProjectInvitations,
  fetchWorkspaceInvitations,
} from "./teamBackend";
import type { Account, AppState } from "./types";
import type { WorkspaceAccountMetadata } from "./workspaceAccountTypes";

export const tokenForState = (state?: AppState | null) => state?.auth.token ?? state?.backend.token;

export function isSuperAdminAccount(account?: Account) {
  return account?.id === "account_admin" || account?.email?.trim().toLowerCase() === "admin";
}

export async function loadWorkspaceAccountMetadata(state: AppState, token = tokenForState(state)): Promise<WorkspaceAccountMetadata> {
  if (!token) {
    return { platformAccounts: [], workspaceInvitations: [], projectInvitations: [] };
  }

  const [platformAccounts, workspaceInvitations, projectInvitations] = await Promise.all([
    isSuperAdminAccount(state.auth.account)
      ? fetchPlatformAccounts(state.backend, token).catch(() => [])
      : Promise.resolve([]),
    fetchWorkspaceInvitations(state.backend, token),
    fetchProjectInvitations(state.backend, token),
  ]);

  return { platformAccounts, workspaceInvitations, projectInvitations };
}
