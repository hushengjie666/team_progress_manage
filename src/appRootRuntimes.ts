import { ensureTodayPlan } from "./appModel";
import type { useAppShellState } from "./appShellState";
import { createAuthSessionRuntime } from "./authSessionRuntime";
import { createSyncCommandRuntime } from "./syncCommandRuntime";
import { createTeamBusinessRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";
import { createWorkspaceAccountRuntime } from "./workspaceAccountRuntime";

type AppShellSource = ReturnType<typeof useAppShellState>;

export function createAppRootRuntimes(shell: AppShellSource) {
  const {
    state,
    setState,
    setToast,
    syncPassword,
    platformAccounts,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
    setSuppressAutoLogin,
    setSelectedTaskId,
    setPreferredFocusTaskId,
    setWorkspaceMode,
    setTab,
    setSyncDiagnostic,
    stateRef,
  } = shell;
  const { persistBusinessChanges, commitBusinessState } = createTeamBusinessRuntime({
    getState: () => stateRef.current,
    setState,
    setToast,
  });
  const workspaceAccountRuntime = createWorkspaceAccountRuntime({
    getState: () => stateRef.current,
    setState,
    setToast,
    setPlatformAccounts,
    getPlatformAccounts: () => platformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });

  const updateState = (updater: (value: AppState) => AppState) => {
    const current = stateRef.current;
    if (!current) return;
    const next = ensureTodayPlan(updater(current));
    stateRef.current = next;
    commitBusinessState(current, next);
  };
  const syncActions = createSyncCommandRuntime({
    getState: () => stateRef.current,
    getSyncPassword: () => syncPassword,
    setState,
    updateState,
    setToast,
    setSyncDiagnostic,
  });
  const authActions = createAuthSessionRuntime({
    getState: () => stateRef.current ?? state,
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
  });

  return {
    persistBusinessChanges,
    commitBusinessState,
    workspaceAccountRuntime,
    updateState,
    syncActions,
    authActions,
  };
}
