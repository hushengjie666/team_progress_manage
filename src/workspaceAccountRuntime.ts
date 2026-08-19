import {
  fetchWorkspaces,
  type AuthSession,
} from "./teamBackend";
import { bindAccountToMembers } from "./authModel";
import { loadTeamData } from "./teamBusinessApi";
import { loadWorkspaceAccountMetadata } from "./workspaceAccountMetadata";
import { createWorkspaceInvitationRuntime } from "./workspaceInvitationRuntime";
import { createWorkspaceMutationRuntime } from "./workspaceMutationRuntime";
import { createWorkspacePlatformAccountRuntime } from "./workspacePlatformAccountRuntime";
import type { WorkspaceAccountRuntime, WorkspaceAccountRuntimeOptions, WorkspaceSessionLoadOptions, WorkspaceSessionLoadResult } from "./workspaceAccountTypes";
import type { AppState } from "./types";

export type { WorkspaceAccountMetadata, WorkspaceAccountRuntime, WorkspaceAccountRuntimeOptions, WorkspaceSessionLoadOptions, WorkspaceSessionLoadResult } from "./workspaceAccountTypes";
export { isSuperAdminAccount, loadWorkspaceAccountMetadata } from "./workspaceAccountMetadata";

export async function loadAuthenticatedWorkspaceSession(
  source: AppState,
  session: AuthSession,
  message: string,
  options: WorkspaceSessionLoadOptions = {},
): Promise<WorkspaceSessionLoadResult> {
  const token = session.token;
  let managedWorkspaces = session.workspaces;
  let workspaceMemberships = source.auth.workspaceMemberships ?? [];
  try {
    const payload = await fetchWorkspaces(source.backend, token);
    managedWorkspaces = payload.workspaces;
    workspaceMemberships = payload.memberships;
  } catch {
    workspaceMemberships = source.auth.workspaceMemberships ?? [];
  }
  const base = options.resetRuntime
    ? {
        ...source,
        activeTimer: undefined,
      }
    : source;
  const bound = bindAccountToMembers(base, {
    status: "authenticated",
    token: session.token,
    expiresAt: session.expiresAt,
    account: session.account,
    workspace: session.workspace,
    membership: session.membership,
    workspaces: managedWorkspaces,
    workspaceMemberships,
    bootstrapped: true,
    message,
  });
  const metadata = await loadWorkspaceAccountMetadata(bound, token);
  return {
    state: await loadTeamData(bound),
    platformAccounts: metadata.platformAccounts,
    workspaceInvitations: metadata.workspaceInvitations,
    projectInvitations: metadata.projectInvitations,
  };
}

export function createWorkspaceAccountRuntime({
  getState,
  setState,
  setToast,
  setPlatformAccounts,
  getPlatformAccounts = () => [],
  setWorkspaceInvitations,
  setProjectInvitations,
  getWorkspaceInvitations,
  getProjectInvitations,
}: WorkspaceAccountRuntimeOptions): WorkspaceAccountRuntime {
  const platformAccounts = createWorkspacePlatformAccountRuntime({
    getState,
    setToast,
    setPlatformAccounts,
    getPlatformAccounts,
  });
  const invitations = createWorkspaceInvitationRuntime({
    getState,
    setState,
    setToast,
    setWorkspaceInvitations,
    setProjectInvitations,
    getWorkspaceInvitations,
    getProjectInvitations,
  });
  const workspaceMutations = createWorkspaceMutationRuntime({
    getState,
    setState,
    setToast,
  });

  return {
    ...platformAccounts,
    ...invitations,
    ...workspaceMutations,
  };
}
