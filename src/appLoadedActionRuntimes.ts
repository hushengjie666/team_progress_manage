import { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { createAppProjectActionsRuntime } from "./appProjectActionsRuntime";
import { createAppSettingsActionsRuntime } from "./appSettingsActionsRuntime";
import { createAppTaskActionsRuntime } from "./appTaskActionsRuntime";
import type { useAppShellState } from "./appShellState";
import type { AppState } from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AppLoadedActionRuntimesOptions = {
  shell: ReturnType<typeof useAppShellState>;
  state: AppState;
  updateState: UpdateState;
  currentProjectId: string;
  runTeamCommand: RunTeamDomainCommand;
};

export function createAppLoadedActionRuntimes({
  shell,
  state,
  updateState,
  currentProjectId,
  runTeamCommand,
}: AppLoadedActionRuntimesOptions) {
  const taskActions = createAppTaskActionsRuntime({
    getState: () => shell.stateRef.current ?? state,
    getCurrentProjectId: () => currentProjectId,
    getDraft: () => shell.draft,
    getSelectedTaskId: () => shell.selectedTaskId,
    getPendingDeleteTask: () => shell.pendingDeleteTask,
    getDeletedTaskSnapshot: () => shell.deletedTaskSnapshot,
    getPendingSplit: () => shell.pendingSplit,
    runTeamCommand,
    updateState,
    setDraft: shell.setDraft,
    setToast: shell.setToast,
    setSelectedTaskId: shell.setSelectedTaskId,
    setPreferredFocusTaskId: shell.setPreferredFocusTaskId,
    setPendingDeleteTask: shell.setPendingDeleteTask,
    setDeletedTaskSnapshot: shell.setDeletedTaskSnapshot,
    setPendingSplit: shell.setPendingSplit,
    setTab: shell.setTab,
    undoTimerRef: shell.undoTimerRef,
  });
  const focusActions = createAppFocusActionsRuntime({
    getState: () => shell.stateRef.current ?? state,
    getQuickNote: () => shell.quickNote,
    updateState,
    runTeamCommand,
    setQuickNote: shell.setQuickNote,
    setToast: shell.setToast,
    setPreferredFocusTaskId: shell.setPreferredFocusTaskId,
    setPendingReset: shell.setPendingReset,
  });
  const projectActions = createAppProjectActionsRuntime({
    getState: () => shell.stateRef.current ?? state,
    runTeamCommand,
    setToast: shell.setToast,
  });
  const settingsActions = createAppSettingsActionsRuntime({
    updateState,
    runTeamCommand,
    setToast: shell.setToast,
  });

  return {
    taskActions,
    focusActions,
    projectActions,
    settingsActions,
  };
}
