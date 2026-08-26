import { useCallback, useRef } from "react";
import { createAppLoadedRuntimes } from "./appLoadedRuntimes";
import { useAppLifecycleHooks } from "./appLifecycleHooks";
import { useAppKeyboardShortcuts } from "./appKeyboardShortcuts";
import { useAppViewModelHooks } from "./appViewModelHooks";
import { createAppRootRuntimes } from "./appRootRuntimes";
import { AppAuthenticatedShellContainer } from "./AppAuthenticatedShellContainer";
import { BootScreen } from "./components/BootScreen";
import { AppCompatibilityGate } from "./components/AppCompatibilityGate";
import { AppUnauthenticatedGate } from "./components/AppUnauthenticatedGate";
import { useAppShellState } from "./appShellState";
import { useDesktopTimerStatus } from "./desktopTimerStatus";
import { useNativeTimerSync } from "./useNativeTimerSync";
import { useIOSDeepLinks } from "./useIOSDeepLinks";
import { createTeamDataRuntime } from "./teamStateRuntime";
import { createDailyPlanForDate, nowIso, today } from "./appModel";
import { taskById } from "./workbenchModel";

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
    selectedWorkspaceId, setSelectedWorkspaceId,
    platformAccounts, setPlatformAccounts, setWorkspaceInvitations, setProjectInvitations,
    stateRef, reminderSentRef, stopNoiseRef, undoTimerRef, tabRef, selectedTaskIdRef,
  } = appShell;
  const teamDataRuntimeRef = useRef<ReturnType<typeof createTeamDataRuntime> | null>(null);
  if (!teamDataRuntimeRef.current) {
    teamDataRuntimeRef.current = createTeamDataRuntime({
      getState: () => stateRef.current,
      setState: (updater) => {
        const current = stateRef.current;
        const next = typeof updater === "function" ? updater(current) : updater;
        stateRef.current = next;
        setState(next);
      },
      setToast,
    });
  }
  const {
    runTeamCommand,
    workspaceAccountRuntime,
    updateState,
    backendActions,
    authActions,
  } = createAppRootRuntimes(appShell, teamDataRuntimeRef.current);

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
    runTeamCommand,
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
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    preferredFocusTaskId,
    setPreferredFocusTaskId,
    selectedTaskId,
    selectedProjectId,
    projectTaskFilters,
  });
  const { workspaceModel } = appViewModel;
  const activeTimerTask = state ? taskById(state, state.activeTimer?.taskId) : undefined;
  const todayPlan = appViewModel.todayPlan ?? (state ? createDailyPlanForDate(state, today(), nowIso()) : undefined);
  const toggleDesktopTimerStatus = useCallback(() => {
    loadedRuntimesRef.current?.focusActions.toggleTimer();
  }, []);
  const abortDesktopTimerStatus = useCallback(() => {
    void loadedRuntimesRef.current?.focusActions.finishTimer("aborted");
  }, []);
  useDesktopTimerStatus({
    state,
    currentTask: activeTimerTask,
    toggleTimer: toggleDesktopTimerStatus,
    abortTimer: abortDesktopTimerStatus,
  });
  useNativeTimerSync(state, activeTimerTask);
  useIOSDeepLinks(appShell.setTab);

  if (!state) {
    loadedRuntimesRef.current = null;
    return <BootScreen />;
  }

  if (state.backend.status === "incompatible") {
    loadedRuntimesRef.current = null;
    return (
      <AppCompatibilityGate
        serverUrl={state.backend.serverUrl}
        compatibility={state.backend.compatibility}
        retry={() => window.location.reload()}
      />
    );
  }

  if (!todayPlan || !workspaceModel) {
    loadedRuntimesRef.current = null;
    return <BootScreen />;
  }

  if (state.auth.status !== "authenticated" || !state.auth.token) {
    loadedRuntimesRef.current = null;
    return (
      <AppUnauthenticatedGate
        status={state.auth.status}
        serverUrl={state.backend.serverUrl}
        message={state.auth.message}
        suppressAutoLogin={suppressAutoLogin}
        updateServerUrl={(serverUrl) => backendActions.updateBackendSetting("serverUrl", serverUrl)}
        login={authActions.handleWorkspaceLogin}
      />
    );
  }

  const loadedRuntimes = createAppLoadedRuntimes({
    shell: appShell,
    state,
    viewModel: appViewModel,
    updateState,
    runTeamCommand,
  });
  loadedRuntimesRef.current = loadedRuntimes;

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
      backendActions={backendActions}
      authActions={authActions}
      loadDemoData={loadedRuntimes.loadDemoData}
      runCommand={loadedRuntimes.runCommand}
    />
  );
}
