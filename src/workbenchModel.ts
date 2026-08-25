import {
  projectMemberIdentityIds,
  taskAssignedToMemberIdentity,
} from "./memberIdentity";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  filterTodayCompletedTasksForMember,
  filterTodayCommittedTasksForMember,
} from "./projectOverview";
import { accessibleProjectIdsForCurrentUser } from "./accessControl";
import type { AppState, DailyPlan, Task } from "./types";
import { currentMemberForState } from "./workbenchFocusModel";
import { filterProjectItemsForWorkspace, projectIdsForWorkspace } from "./workspaceScope";

export { activeTimerForFocus, committedTasksForPlan, currentMemberForState, currentTaskForFocus, focusTasksForMember, taskById } from "./workbenchFocusModel";
export { poolTasksForFilters } from "./workbenchPoolTasks";

export const deriveWorkspaceModel = (
  state: AppState,
  todayPlan: DailyPlan,
  totalCommittedEstimate: number,
  committedTasks: Task[],
  poolTasks: Task[],
  selectedWorkbenchProjectIds: string[],
  selectedWorkspaceId: string | null = null,
) => {
  const remainingEstimate = Math.max(0, totalCommittedEstimate - todayPlan.completedPomodoros);
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  const currentMember = currentMemberForState(state);
  const workspaceProjectIds = projectIdsForWorkspace(state, selectedWorkspaceId);
  const myProjectTaskCards = filterProjectItemsForWorkspace(
    buildMyProjectTaskCards(state, currentMember),
    workspaceProjectIds,
  );
  const accessibleProjectIds = new Set(
    [...accessibleProjectIdsForCurrentUser(state, currentMember)].filter((projectId) => workspaceProjectIds.has(projectId)),
  );
  const todayCommittedTasks = filterProjectItemsForWorkspace(
    filterTodayCommittedTasksForMember(state, committedTasks, currentMember, { includeUnassigned: true }),
    workspaceProjectIds,
  );
  const todayCompletedTasks = filterProjectItemsForWorkspace(
    filterTodayCompletedTasksForMember(state, todayPlan.date, currentMember, { includeUnassigned: true }),
    workspaceProjectIds,
  );
  const todayWorkbenchTasks = [
    ...todayCommittedTasks,
    ...todayCompletedTasks.filter((task) => !todayCommittedTasks.some((item) => item.id === task.id)),
  ];
  const availableWorkbenchProjectIds = Array.from(new Set([
    ...myProjectTaskCards.map((card) => card.projectId),
    ...todayWorkbenchTasks.map((task) => task.projectId),
  ]));
  const effectiveWorkbenchProjectIds = selectedWorkbenchProjectIds.length > 0
    ? selectedWorkbenchProjectIds
    : availableWorkbenchProjectIds;
  const selectedProjectIdSet = new Set(effectiveWorkbenchProjectIds);
  const memberIdentityIds = projectMemberIdentityIds(state, currentMember);
  const isVisibleWorkbenchTask = (task: Task) =>
    selectedProjectIdSet.has(task.projectId) &&
    task.status !== "split" &&
    task.status !== "archived" &&
    accessibleProjectIds.has(task.projectId);
  const isVisiblePoolWorkbenchTask = (task: Task) =>
    selectedProjectIdSet.has(task.projectId) &&
    task.status !== "completed" &&
    task.status !== "split" &&
    task.status !== "archived" &&
    accessibleProjectIds.has(task.projectId) &&
    taskAssignedToMemberIdentity(task, memberIdentityIds, { includeUnassigned: true });
  const committedWorkbenchTasks = todayWorkbenchTasks.filter(isVisibleWorkbenchTask);
  const poolWorkbenchTasks = filterProjectItemsForWorkspace(poolTasks, workspaceProjectIds).filter(isVisiblePoolWorkbenchTask);
  const allProjectOverviewCards = buildProjectOverviewCards(state);
  const projectOverviewCards = filterProjectItemsForWorkspace(allProjectOverviewCards, workspaceProjectIds);

  return {
    remainingEstimate,
    projects,
    tags,
    currentMember,
    myProjectTaskCards,
    availableWorkbenchProjectIds,
    effectiveWorkbenchProjectIds,
    committedWorkbenchTasks,
    poolWorkbenchTasks,
    projectOverviewCards,
    allProjectOverviewCards,
  };
};

export type WorkspaceViewModel = ReturnType<typeof deriveWorkspaceModel>;
