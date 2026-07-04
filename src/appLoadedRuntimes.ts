import { createAppLoadedActionRuntimes } from "./appLoadedActionRuntimes";
import { createAppLoadedSupportRuntimes } from "./appLoadedSupportRuntimes";
import type { useAppShellState } from "./appShellState";
import type { useAppViewModelHooks } from "./appViewModelHooks";
import type { TeamDataRuntime } from "./teamStateRuntime";
import type { AppState } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

type AppLoadedRuntimesOptions = {
  shell: ReturnType<typeof useAppShellState>;
  state: AppState;
  viewModel: ReturnType<typeof useAppViewModelHooks>;
  updateState: UpdateState;
  persistTeamData: TeamDataRuntime["persistTeamData"];
};

export function createAppLoadedRuntimes({
  shell,
  state,
  viewModel,
  updateState,
  persistTeamData,
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
    persistTeamData,
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
