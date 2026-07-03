import { nowIso } from "./appModel";
import type { AuthSession } from "./sync";
import { loadAuthenticatedWorkspaceSession } from "./workspaceAccountRuntime";
import type { Account, AppState, AuthState, ProjectInvitation, WorkspaceInvitation } from "./types";

type SetState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;

type AuthSessionStateToolsOptions = {
  getState: () => AppState | null;
  setState: SetState;
  setPlatformAccounts: (accounts: Account[]) => void;
  setWorkspaceInvitations: (invitations: WorkspaceInvitation[]) => void;
  setProjectInvitations: (invitations: ProjectInvitation[]) => void;
};

export function createAuthSessionStateTools({
  getState,
  setState,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
}: AuthSessionStateToolsOptions) {
  const setAuthPatch = (patch: Partial<AuthState>) => {
    setState((current) =>
      current
        ? {
            ...current,
            auth: { ...current.auth, ...patch },
            updatedAt: nowIso(),
          }
        : current,
    );
  };

  const applySession = async (session: AuthSession, message: string, options: { resetRuntime?: boolean } = {}) => {
    const source = getState();
    if (!source) throw new Error("应用状态尚未加载");
    const loaded = await loadAuthenticatedWorkspaceSession(source, session, message, options);
    setPlatformAccounts(loaded.platformAccounts);
    setWorkspaceInvitations(loaded.workspaceInvitations);
    setProjectInvitations(loaded.projectInvitations);
    setState(loaded.state);
  };

  return {
    setAuthPatch,
    applySession,
  };
}
