import { useMemo } from "react";
import { today } from "./appModel";
import { resolveMemberIdForProject } from "./memberIdentity";
import { deriveProjectDetailModel, type ProjectTaskFilters } from "./projectDetail";
import type { Account, AppState } from "./types";
import { taskById } from "./workbenchModel";

export type AppProjectDetailViewModelHooksOptions = {
  state: AppState | null;
  platformAccounts: Account[];
  selectedTaskId: string | null;
  selectedProjectId: string | null;
  projectTaskFilters: ProjectTaskFilters;
};

export function useAppProjectDetailViewModelHooks({
  state,
  platformAccounts,
  selectedTaskId,
  selectedProjectId,
  projectTaskFilters,
}: AppProjectDetailViewModelHooksOptions) {
  const selectedTask = useMemo(() => {
    if (!state) return undefined;
    return taskById(state, selectedTaskId);
  }, [state, selectedTaskId]);

  const primaryProjectId = state?.projects[0]?.id ?? "";
  const activeProjectId = selectedProjectId && state?.projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : primaryProjectId;
  const projectDetailDate = today();
  const projectDetailModel = useMemo(() => {
    if (!state || !activeProjectId) return undefined;
    return deriveProjectDetailModel(state, activeProjectId, projectTaskFilters, projectDetailDate, platformAccounts);
  }, [state, activeProjectId, projectTaskFilters, projectDetailDate, platformAccounts]);
  const currentProjectMemberId = useMemo(() => {
    if (!state || !activeProjectId) return undefined;
    return resolveMemberIdForProject(state, activeProjectId);
  }, [state, activeProjectId]);

  return {
    selectedTask,
    primaryProjectId,
    activeProjectId,
    projectDetailDate,
    projectDetailModel,
    currentProjectMemberId,
  };
}
