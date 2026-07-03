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

export { committedTasksForPlan, currentMemberForState, currentTaskForFocus, focusTasksForMember, taskById } from "./workbenchFocusModel";
export { poolTasksForFilters } from "./workbenchPoolTasks";

export const deriveWorkspaceModel = (
  state: AppState,
  todayPlan: DailyPlan,
  totalCommittedEstimate: number,
  committedTasks: Task[],
  poolTasks: Task[],
  selectedWorkbenchProjectIds: string[],
) => {
  const remainingEstimate = Math.max(0, totalCommittedEstimate - todayPlan.completedPomodoros);
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  const currentMember = currentMemberForState(state);
  const myProjectTaskCards = buildMyProjectTaskCards(state, currentMember);
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state, currentMember);
  const todayCommittedTasks = filterTodayCommittedTasksForMember(state, committedTasks, currentMember, { includeUnassigned: true });
  const todayCompletedTasks = filterTodayCompletedTasksForMember(state, todayPlan.date, currentMember, { includeUnassigned: true });
  const todayAccessibleCommittedTasks = committedTasks.filter((task) => accessibleProjectIds.has(task.projectId));
  const todayAccessibleCompletedTasks = state.tasks.filter(
    (task) =>
      accessibleProjectIds.has(task.projectId) &&
      task.status === "completed" &&
      task.completedAt?.slice(0, 10) === todayPlan.date,
  );
  const todayWorkbenchTasks = [
    ...todayCommittedTasks,
    ...todayCompletedTasks.filter((task) => !todayCommittedTasks.some((item) => item.id === task.id)),
    ...todayAccessibleCommittedTasks.filter(
      (task) => !todayCommittedTasks.some((item) => item.id === task.id) && !todayCompletedTasks.some((item) => item.id === task.id),
    ),
    ...todayAccessibleCompletedTasks.filter(
      (task) =>
        !todayCommittedTasks.some((item) => item.id === task.id) &&
        !todayCompletedTasks.some((item) => item.id === task.id) &&
        !todayAccessibleCommittedTasks.some((item) => item.id === task.id),
    ),
  ];
  const todayWorkbenchTaskIds = new Set(todayWorkbenchTasks.map((task) => task.id));
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
    accessibleProjectIds.has(task.projectId) &&
    (taskAssignedToMemberIdentity(task, memberIdentityIds) || todayWorkbenchTaskIds.has(task.id));
  const isVisiblePoolWorkbenchTask = (task: Task) =>
    selectedProjectIdSet.has(task.projectId) &&
    task.status !== "completed" &&
    task.status !== "split" &&
    task.status !== "archived" &&
    accessibleProjectIds.has(task.projectId);
  const committedWorkbenchTasks = todayWorkbenchTasks.filter(isVisibleWorkbenchTask);
  const poolWorkbenchTasks = poolTasks.filter(isVisiblePoolWorkbenchTask);
  const projectOverviewCards = buildProjectOverviewCards(state);

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
  };
};

export type WorkspaceViewModel = ReturnType<typeof deriveWorkspaceModel>;
