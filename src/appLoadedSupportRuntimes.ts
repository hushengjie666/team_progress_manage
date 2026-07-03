import { createAppCommandRuntime } from "./appCommandRuntime";
import { createAppDemoDataRuntime } from "./appDemoDataRuntime";
import { createAppNavigationRuntime } from "./appNavigationRuntime";
import { createAppQuickProjectRuntime } from "./appQuickProjectRuntime";
import { createDataPortabilityRuntime } from "./dataPortabilityRuntime";
import type { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import type { createAppProjectActionsRuntime } from "./appProjectActionsRuntime";
import type { useAppShellState } from "./appShellState";
import type { useAppViewModelHooks } from "./appViewModelHooks";
import type { TeamStateRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AppLoadedSupportRuntimesOptions = {
  shell: ReturnType<typeof useAppShellState>;
  state: AppState;
  viewModel: ReturnType<typeof useAppViewModelHooks>;
  updateState: UpdateState;
  persistTeamChanges: TeamStateRuntime["persistTeamChanges"];
  commitTeamState: TeamStateRuntime["commitTeamState"];
  currentProjectId: string;
  focusActions: ReturnType<typeof createAppFocusActionsRuntime>;
  projectActions: ReturnType<typeof createAppProjectActionsRuntime>;
};

export function createAppLoadedSupportRuntimes({
  shell,
  state,
  viewModel,
  updateState,
  persistTeamChanges,
  commitTeamState,
  currentProjectId,
  focusActions,
  projectActions,
}: AppLoadedSupportRuntimesOptions) {
  const dataPortability = createDataPortabilityRuntime({
    getState: () => shell.stateRef.current,
    pendingImportPayloadRef: shell.pendingImportPayloadRef,
    setImportSummary: shell.setImportSummary,
    setToast: shell.setToast,
    commitTeamState,
  });
  const { loadDemoData } = createAppDemoDataRuntime({
    getState: () => shell.stateRef.current,
    getSelectedProjectId: () => shell.selectedProjectId,
    persistTeamChanges,
    setState: shell.setState,
    setToast: shell.setToast,
    setSelectedProjectId: shell.setSelectedProjectId,
    setProjectDetailTab: shell.setProjectDetailTab,
    setSelectedTaskId: shell.setSelectedTaskId,
    setTaskFilters: shell.setTaskFilters,
    setTab: shell.setTab,
  });
  const navigation = createAppNavigationRuntime({
    tab: shell.tab,
    workspaceMode: shell.workspaceMode,
    setSettingsSection: shell.setSettingsSection,
    setTab: shell.setTab,
    setWorkspaceMode: shell.setWorkspaceMode,
    setSelectedProjectId: shell.setSelectedProjectId,
    setProjectDetailTab: shell.setProjectDetailTab,
    setSelectedTaskId: shell.setSelectedTaskId,
  });
  const { runCommand } = createAppCommandRuntime({
    getState: () => shell.stateRef.current ?? state,
    getCurrentProjectId: () => currentProjectId,
    getCurrentTaskId: () => viewModel.currentTask?.id,
    getFirstCommittedTaskId: () => viewModel.committedTasks[0]?.id,
    updateState,
    setSelectedTaskId: shell.setSelectedTaskId,
    setWorkspaceMode: shell.setWorkspaceMode,
    setSettingsSection: shell.setSettingsSection,
    setCommandPaletteOpen: shell.setCommandPaletteOpen,
    setShowShortcutHelp: shell.setShowShortcutHelp,
    setTab: shell.setTab,
    setToast: shell.setToast,
    openBoard: navigation.openBoard,
    openWorkbench: navigation.openWorkbench,
    beginTimer: focusActions.beginTimer,
    toggleTimer: focusActions.toggleTimer,
    addInterruption: focusActions.addInterruption,
  });
  const quickProject = createAppQuickProjectRuntime({
    getState: () => state,
    getDraft: () => shell.quickProjectDraft,
    setDraft: shell.setQuickProjectDraft,
    setWarning: shell.setQuickProjectWarning,
    setOpen: shell.setQuickProjectCreateOpen,
    createProject: projectActions.createProject,
  });

  return {
    dataPortability,
    loadDemoData,
    navigation,
    runCommand,
    quickProject,
  };
}
