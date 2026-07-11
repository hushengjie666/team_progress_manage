import { ensureTodayPlan } from "./appModel";
import type { useAppShellState } from "./appShellState";
import { createAuthSessionRuntime } from "./authSessionRuntime";
import { createBackendCommandRuntime } from "./teamBackendCommandRuntime";
import type { TeamDataRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";
import { createWorkspaceAccountRuntime } from "./workspaceAccountRuntime";

type AppShellSource = ReturnType<typeof useAppShellState>;

export function createAppRootRuntimes(shell: AppShellSource, teamDataRuntime: TeamDataRuntime) {
  const {
    state,
    setState,
    setToast,
    backendPassword,
    platformAccounts,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
    setSuppressAutoLogin,
    setSelectedTaskId,
    setPreferredFocusTaskId,
    setWorkspaceMode,
    setTab,
    setBackendDiagnostic,
    stateRef,
  } = shell;
  const { persistTeamData, commitTeamData } = teamDataRuntime;
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
    commitTeamData(current, next);
  };
  const backendActions = createBackendCommandRuntime({
    getState: () => stateRef.current,
    getBackendPassword: () => backendPassword,
    setState,
    updateState,
    setToast,
    setBackendDiagnostic,
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
    persistTeamData,
    commitTeamData,
    workspaceAccountRuntime,
    updateState,
    backendActions,
    authActions,
  };
}
