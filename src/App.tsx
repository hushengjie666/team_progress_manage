import { useRef } from "react";
import { createAppLoadedRuntimes } from "./appLoadedRuntimes";
import { useAppLifecycleHooks } from "./appLifecycleHooks";
import { useAppKeyboardShortcuts } from "./appKeyboardShortcuts";
import { useAppViewModelHooks } from "./appViewModelHooks";
import { createAppRootRuntimes } from "./appRootRuntimes";
import { AppAuthenticatedShellContainer } from "./AppAuthenticatedShellContainer";
import { BootScreen } from "./components/BootScreen";
import { AppUnauthenticatedGate } from "./components/AppUnauthenticatedGate";
import { useAppShellState } from "./appShellState";

export function App() {
  const appShell = useAppShellState();
  const loadedRuntimesRef = useRef<ReturnType<typeof createAppLoadedRuntimes> | null>(null);
  const {
    state, setState, tab,
    selectedProjectId, projectTaskFilters, taskFilters,
    loaded, setLoaded, toast, setToast, setToastVisible,
    suppressAutoLogin,
    selectedTaskId, preferredFocusTaskId, setPreferredFocusTaskId,
    selectedWorkbenchProjectIds, setSelectedWorkbenchProjectIds,
    platformAccounts, setPlatformAccounts, setWorkspaceInvitations, setProjectInvitations,
    stateRef, reminderSentRef, stopNoiseRef, undoTimerRef, tabRef, selectedTaskIdRef,
  } = appShell;
  const {
    persistTeamChanges,
    commitTeamState,
    workspaceAccountRuntime,
    updateState,
    syncActions,
    authActions,
  } = createAppRootRuntimes(appShell);

  useAppLifecycleHooks({
    state,
    loaded,
    toast,
    tab,
    selectedTaskId,
    stateRef,
    tabRef,
    selectedTaskIdRef,
    undoTimerRef,
    stopNoiseRef,
    reminderSentRef,
    persistTeamChanges,
    commitTeamState,
    setState,
    setToast,
    setToastVisible,
    setLoaded,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });

  useAppKeyboardShortcuts({
    shell: appShell,
    beginTimer: (mode, taskId) => loadedRuntimesRef.current?.focusActions.beginTimer(mode, taskId) ?? Promise.resolve(),
    toggleTimer: () => loadedRuntimesRef.current?.focusActions.toggleTimer(),
    moveCommittedTask: (taskId, direction) => loadedRuntimesRef.current?.taskActions.moveCommittedTask(taskId, direction),
  });

  const appViewModel = useAppViewModelHooks({
    state,
    platformAccounts,
    taskFilters,
    selectedWorkbenchProjectIds,
    setSelectedWorkbenchProjectIds,
    preferredFocusTaskId,
    setPreferredFocusTaskId,
    selectedTaskId,
    selectedProjectId,
    projectTaskFilters,
  });
  const { todayPlan, workspaceModel } = appViewModel;

  if (!state || !todayPlan || !workspaceModel) {
    loadedRuntimesRef.current = null;
    return <BootScreen />;
  }

  const loadedRuntimes = createAppLoadedRuntimes({
    shell: appShell,
    state,
    viewModel: appViewModel,
    updateState,
    persistTeamChanges,
  });
  loadedRuntimesRef.current = loadedRuntimes;
  if (state.auth.status !== "authenticated" || !state.auth.token) {
    return (
      <AppUnauthenticatedGate
        status={state.auth.status}
        serverUrl={state.sync.serverUrl}
        message={state.auth.message}
        suppressAutoLogin={suppressAutoLogin}
        updateServerUrl={(serverUrl) => syncActions.updateSyncSetting("serverUrl", serverUrl)}
        checkStatus={authActions.checkAuthStatus}
        login={authActions.handleWorkspaceLogin}
      />
    );
  }

  return (
    <AppAuthenticatedShellContainer
      shell={appShell}
      viewModel={{
        ...appViewModel,
        todayPlan,
        workspaceModel,
      }}
      state={state}
      navigation={loadedRuntimes.navigation}
      quickProject={loadedRuntimes.quickProject}
      workspaceAccountRuntime={workspaceAccountRuntime}
      taskActions={loadedRuntimes.taskActions}
      focusActions={loadedRuntimes.focusActions}
      projectActions={loadedRuntimes.projectActions}
      settingsActions={loadedRuntimes.settingsActions}
      syncActions={syncActions}
      authActions={authActions}
      loadDemoData={loadedRuntimes.loadDemoData}
      runCommand={loadedRuntimes.runCommand}
    />
  );
}
