import type { TaskFilters } from "./appModel";
import { useAppProjectDetailViewModelHooks } from "./appProjectDetailViewModelHooks";
import { useAppWorkspaceViewModelHooks } from "./appWorkspaceViewModelHooks";
import type { ProjectTaskFilters } from "./projectDetail";
import type { Account, AppState } from "./types";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppViewModelHooksOptions = {
  state: AppState | null;
  platformAccounts: Account[];
  taskFilters: TaskFilters;
  selectedWorkbenchProjectIds: string[];
  setSelectedWorkbenchProjectIds: Setter<string[]>;
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: Setter<string | null>;
  preferredFocusTaskId: string | null;
  setPreferredFocusTaskId: Setter<string | null>;
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  projectTaskFilters: ProjectTaskFilters;
};

export function useAppViewModelHooks({
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
}: AppViewModelHooksOptions) {
  const workspaceViewModel = useAppWorkspaceViewModelHooks({
    state,
    taskFilters,
    selectedWorkbenchProjectIds,
    setSelectedWorkbenchProjectIds,
    selectedWorkspaceId,
    setSelectedWorkspaceId,
    preferredFocusTaskId,
    setPreferredFocusTaskId,
  });
  const projectDetailViewModel = useAppProjectDetailViewModelHooks({
    state,
    platformAccounts,
    selectedTaskId,
    selectedProjectId,
    projectTaskFilters,
  });

  return {
    ...workspaceViewModel,
    ...projectDetailViewModel,
  };
}
