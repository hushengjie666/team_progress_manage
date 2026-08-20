import { useEffect, useMemo, useRef } from "react";
import { getTodayPlan, type TaskFilters } from "./appModel";
import type { AppState } from "./types";
import { workspacesForState } from "./accessControl";
import {
  committedTasksForPlan,
  currentMemberForState,
  currentTaskForFocus,
  deriveWorkspaceModel,
  focusTasksForMember,
  poolTasksForFilters,
} from "./workbenchModel";
import { filterProjectItemsForWorkspace, projectIdsForWorkspace, validWorkspaceSelection } from "./workspaceScope";
import { loadWorkspaceScopePreference, saveWorkspaceScopePreference } from "./workspaceScopePreference";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppWorkspaceViewModelHooksOptions = {
  state: AppState | null;
  taskFilters: TaskFilters;
  selectedWorkbenchProjectIds: string[];
  setSelectedWorkbenchProjectIds: Setter<string[]>;
  selectedWorkspaceId: string | null;
  setSelectedWorkspaceId: Setter<string | null>;
  preferredFocusTaskId: string | null;
  setPreferredFocusTaskId: Setter<string | null>;
};

export function useAppWorkspaceViewModelHooks({
  state,
  taskFilters,
  selectedWorkbenchProjectIds,
  setSelectedWorkbenchProjectIds,
  selectedWorkspaceId,
  setSelectedWorkspaceId,
  preferredFocusTaskId,
  setPreferredFocusTaskId,
}: AppWorkspaceViewModelHooksOptions) {
  const restoredWorkspaceAccountRef = useRef<string | null>(null);
  const todayPlan = state ? getTodayPlan(state) : null;

  const committedTasks = useMemo(() => {
    if (!state || !todayPlan) return [];
    const tasks = committedTasksForPlan(state, todayPlan);
    return selectedWorkspaceId
      ? filterProjectItemsForWorkspace(tasks, projectIdsForWorkspace(state, selectedWorkspaceId))
      : tasks;
  }, [state, todayPlan, selectedWorkspaceId]);

  const totalCommittedEstimate = useMemo(
    () => committedTasks.reduce((sum, task) => sum + task.estimatePomodoros, 0),
    [committedTasks],
  );

  const currentMember = useMemo(() => {
    if (!state) return undefined;
    return currentMemberForState(state);
  }, [state]);

  const focusCommittedTasks = useMemo(() => {
    if (!state) return [];
    return focusTasksForMember(state, committedTasks, currentMember);
  }, [state, committedTasks, currentMember]);

  useEffect(() => {
    if (!preferredFocusTaskId) return;
    const preferredTask = focusCommittedTasks.find((task) => task.id === preferredFocusTaskId);
    if (
      !preferredTask ||
      (preferredTask.status !== "committed" && preferredTask.status !== "in_progress" && preferredTask.status !== "pending_review")
    ) {
      setPreferredFocusTaskId(null);
    }
  }, [focusCommittedTasks, preferredFocusTaskId]);

  const poolTasks = useMemo(() => {
    if (!state || !todayPlan) return [];
    return poolTasksForFilters(state, todayPlan, taskFilters);
  }, [state, todayPlan, taskFilters]);

  const workspaceModel = useMemo(() => {
    if (!state || !todayPlan) return null;
    return deriveWorkspaceModel(
      state,
      todayPlan,
      totalCommittedEstimate,
      committedTasks,
      poolTasks,
      selectedWorkbenchProjectIds,
      selectedWorkspaceId,
    );
  }, [state, todayPlan, totalCommittedEstimate, committedTasks, poolTasks, selectedWorkbenchProjectIds, selectedWorkspaceId]);

  useEffect(() => {
    const accountId = state?.auth.account?.id;
    if (!state || !accountId) {
      restoredWorkspaceAccountRef.current = null;
      setSelectedWorkspaceId(null);
      return;
    }
    const workspaces = workspacesForState(state);
    if (!workspaces.length) {
      setSelectedWorkspaceId(null);
      return;
    }
    if (restoredWorkspaceAccountRef.current !== accountId) {
      const preferredWorkspaceId = loadWorkspaceScopePreference(accountId);
      const nextWorkspaceId = validWorkspaceSelection(workspaces, preferredWorkspaceId);
      if (preferredWorkspaceId && !nextWorkspaceId) saveWorkspaceScopePreference(accountId, null);
      restoredWorkspaceAccountRef.current = accountId;
      setSelectedWorkspaceId(nextWorkspaceId);
      return;
    }
    setSelectedWorkspaceId((current) => {
      const nextWorkspaceId = validWorkspaceSelection(workspaces, current);
      if (current && !nextWorkspaceId) saveWorkspaceScopePreference(accountId, null);
      return nextWorkspaceId;
    });
  }, [state?.auth.account?.id, state?.auth.workspaces, state?.auth.workspace]);

  useEffect(() => {
    setSelectedWorkbenchProjectIds([]);
  }, [workspaceModel?.currentMember?.id]);

  useEffect(() => {
    setSelectedWorkbenchProjectIds((current) => {
      const available = new Set(workspaceModel?.availableWorkbenchProjectIds ?? []);
      const next = current.filter((projectId) => available.has(projectId));
      return next.length === current.length ? current : next;
    });
  }, [workspaceModel?.availableWorkbenchProjectIds.join("|")]);

  const toggleWorkbenchProject = (projectId: string) => {
    setSelectedWorkbenchProjectIds((current) => {
      return current.includes(projectId)
        ? current.filter((item) => item !== projectId)
        : [...current, projectId];
    });
  };

  const currentTask = useMemo(() => {
    if (!state) return undefined;
    return currentTaskForFocus(state, focusCommittedTasks, preferredFocusTaskId);
  }, [state, focusCommittedTasks, preferredFocusTaskId]);

  return {
    todayPlan,
    committedTasks,
    currentMember,
    focusCommittedTasks,
    poolTasks,
    workspaceModel,
    toggleWorkbenchProject,
    currentTask,
  };
}
