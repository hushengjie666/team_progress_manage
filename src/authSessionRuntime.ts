import { createAuthLogoutAction } from "./authSessionLogout";
import { createAuthStatusAction } from "./authSessionStatus";
import { createAuthSessionStateTools } from "./authSessionStateTools";
import type { AuthSessionRuntime, AuthSessionRuntimeOptions } from "./authSessionTypes";
import { createAuthWorkspaceActions } from "./authSessionWorkspaceActions";

export type { AuthSessionRuntime, AuthSessionRuntimeOptions } from "./authSessionTypes";

export function createAuthSessionRuntime({
  getState,
  setState,
  updateState,
  setToast,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
  setSuppressAutoLogin,
  setSelectedTaskId,
  setPreferredFocusTaskId,
  setWorkspaceMode,
  setTab,
}: AuthSessionRuntimeOptions): AuthSessionRuntime {
  const { setAuthPatch, applySession } = createAuthSessionStateTools({
    getState,
    setState,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });
  const checkAuthStatus = createAuthStatusAction({ getState, setAuthPatch });
  const { handleCreateWorkspace, handleWorkspaceLogin } = createAuthWorkspaceActions({
    getState,
    setAuthPatch,
    applySession,
    setToast,
    setSuppressAutoLogin,
    setSelectedTaskId,
    setPreferredFocusTaskId,
    setWorkspaceMode,
    setTab,
  });
  const logout = createAuthLogoutAction({
    updateState,
    setToast,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
    setSuppressAutoLogin,
  });

  return {
    checkAuthStatus,
    handleCreateWorkspace,
    handleWorkspaceLogin,
    logout,
  };
}
