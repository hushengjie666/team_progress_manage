import type { TaskFilters } from "./appModel";
import { useAppProjectDetailViewModelHooks } from "./appProjectDetailViewModelHooks";
import { useAppWorkspaceViewModelHooks } from "./appWorkspaceViewModelHooks";
import type { ProjectTaskFilters } from "./projectDetail";
import type { AppState } from "./types";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppViewModelHooksOptions = {
  state: AppState | null;
  taskFilters: TaskFilters;
  selectedWorkbenchProjectIds: string[];
  setSelectedWorkbenchProjectIds: Setter<string[]>;
  preferredFocusTaskId: string | null;
  setPreferredFocusTaskId: Setter<string | null>;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  projectTaskFilters: ProjectTaskFilters;
};

export function useAppViewModelHooks({
  state,
  taskFilters,
  selectedWorkbenchProjectIds,
  setSelectedWorkbenchProjectIds,
  preferredFocusTaskId,
  setPreferredFocusTaskId,
  selectedTaskId,
  selectedProjectId,
  projectTaskFilters,
}: AppViewModelHooksOptions) {
  const workspaceViewModel = useAppWorkspaceViewModelHooks({
    state,
    taskFilters,
    selectedWorkbenchProjectIds,
    setSelectedWorkbenchProjectIds,
    preferredFocusTaskId,
    setPreferredFocusTaskId,
  });
  const projectDetailViewModel = useAppProjectDetailViewModelHooks({
    state,
    selectedTaskId,
    selectedProjectId,
    projectTaskFilters,
  });

  return {
    ...workspaceViewModel,
    ...projectDetailViewModel,
  };
}
