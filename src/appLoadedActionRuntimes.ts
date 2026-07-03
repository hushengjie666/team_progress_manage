import { createAppDailyReviewRuntime } from "./appDailyReviewRuntime";
import { createAppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { createAppProjectActionsRuntime } from "./appProjectActionsRuntime";
import { createAppSettingsActionsRuntime } from "./appSettingsActionsRuntime";
import { createAppTaskActionsRuntime } from "./appTaskActionsRuntime";
import type { useAppShellState } from "./appShellState";
import type { AppState } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AppLoadedActionRuntimesOptions = {
  shell: ReturnType<typeof useAppShellState>;
  state: AppState;
  updateState: UpdateState;
  currentProjectId: string;
};

export function createAppLoadedActionRuntimes({
  shell,
  state,
  updateState,
  currentProjectId,
}: AppLoadedActionRuntimesOptions) {
  const taskActions = createAppTaskActionsRuntime({
    getState: () => shell.stateRef.current ?? state,
    getCurrentProjectId: () => currentProjectId,
    getDraft: () => shell.draft,
    getSelectedTaskId: () => shell.selectedTaskId,
    getPendingDeleteTask: () => shell.pendingDeleteTask,
    getDeletedTaskSnapshot: () => shell.deletedTaskSnapshot,
    getPendingSplit: () => shell.pendingSplit,
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
    setQuickNote: shell.setQuickNote,
    setToast: shell.setToast,
    setPreferredFocusTaskId: shell.setPreferredFocusTaskId,
    setPendingReset: shell.setPendingReset,
  });
  const dailyActions = createAppDailyReviewRuntime({
    updateState,
    setToast: shell.setToast,
  });
  const projectActions = createAppProjectActionsRuntime({
    updateState,
    setToast: shell.setToast,
  });
  const settingsActions = createAppSettingsActionsRuntime({
    updateState,
    setToast: shell.setToast,
  });

  return {
    taskActions,
    focusActions,
    dailyActions,
    projectActions,
    settingsActions,
  };
}
