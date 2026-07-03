import { createAppLoadedActionRuntimes } from "./appLoadedActionRuntimes";
import { createAppLoadedSupportRuntimes } from "./appLoadedSupportRuntimes";
import type { useAppShellState } from "./appShellState";
import type { useAppViewModelHooks } from "./appViewModelHooks";
import type { TeamStateRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AppLoadedRuntimesOptions = {
  shell: ReturnType<typeof useAppShellState>;
  state: AppState;
  viewModel: ReturnType<typeof useAppViewModelHooks>;
  updateState: UpdateState;
  persistTeamChanges: TeamStateRuntime["persistTeamChanges"];
};

export function createAppLoadedRuntimes({
  shell,
  state,
  viewModel,
  updateState,
  persistTeamChanges,
}: AppLoadedRuntimesOptions) {
  const currentProjectId = state.projects[0]?.id ?? "project_starter";
  const {
    taskActions,
    focusActions,
    projectActions,
    settingsActions,
  } = createAppLoadedActionRuntimes({
    shell,
    state,
    updateState,
    currentProjectId,
  });
  const {
    loadDemoData,
    navigation,
    runCommand,
    quickProject,
  } = createAppLoadedSupportRuntimes({
    shell,
    state,
    viewModel,
    updateState,
    persistTeamChanges,
    currentProjectId,
    focusActions,
    projectActions,
  });

  return {
    taskActions,
    focusActions,
    projectActions,
    settingsActions,
    loadDemoData,
    navigation,
    runCommand,
    quickProject,
  };
}
