import {
  accessibleProjectIdsForCurrentUser,
  projectMemberIdentityIds,
  taskBelongsToMemberIdentity,
  workspaceForProject,
  workspaceIdForProject,
} from "./accessControl";
import { dailyTaskBelongsToAccount, dailyTaskForDate } from "./dailyTasks";
import { localDateForTimestamp } from "./appClock";
import { buildProgressBoard } from "./progressBoard";
import type { MyProjectTaskCard } from "./projectOverviewTypes";
import type { AppState, ProjectMember, Task } from "./types";

export const filterMyTasksByProjectSelection = (
  state: AppState,
  currentMember: ProjectMember | undefined,
  selectedProjectIds: string[],
) => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state, currentMember);
  if (accessibleProjectIds.size === 0) return [];
  const selectedProjects = selectedProjectIds.length > 0
    ? new Set(selectedProjectIds.filter((projectId) => accessibleProjectIds.has(projectId)))
    : accessibleProjectIds;
  return state.tasks.filter(
    (task) =>
      selectedProjects.has(task.projectId) &&
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived",
  );
};

export const filterTodayCommittedTasksForMember = (
  state: AppState,
  tasks: Task[],
  currentMember: ProjectMember | undefined,
  options: { includeProjectOwnerUnassigned?: boolean; includeUnassigned?: boolean } = {},
) => {
  const memberIds = projectMemberIdentityIds(state, currentMember);
  return tasks.filter((task) => task.isDaily ? dailyTaskBelongsToAccount(state, task) :
    memberIds.size > 0 && taskBelongsToMemberIdentity(state, task, memberIds, options));
};

export const filterTodayCompletedTasksForMember = (
  state: AppState,
  date: string,
  currentMember: ProjectMember | undefined,
  options: { includeProjectOwnerUnassigned?: boolean; includeUnassigned?: boolean } = {},
) => {
  const memberIds = projectMemberIdentityIds(state, currentMember);
  return state.tasks.filter(
    (task) => task.isDaily
      ? task.dailyCompletedDates?.includes(date) && dailyTaskBelongsToAccount(state, task) && task.dailyRemovedDates?.[state.auth.account!.id] !== date
      : memberIds.size > 0 &&
      task.status === "completed" &&
      localDateForTimestamp(task.completedAt) === date &&
      taskBelongsToMemberIdentity(state, task, memberIds, options),
  ).map((task) => dailyTaskForDate(task, date));
};

export const quickAddProjectIdForSelection = (selectedProjectIds: string[]) =>
  selectedProjectIds.length === 1 ? selectedProjectIds[0] : undefined;

export const buildMyProjectTaskCards = (state: AppState, currentMember?: ProjectMember): MyProjectTaskCard[] => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state, currentMember);
  if (accessibleProjectIds.size === 0) return [];

  return state.projects
    .filter((project) => accessibleProjectIds.has(project.id))
    .map((project) => {
      const workspace = workspaceForProject(state, project);
      const workspaceId = workspaceIdForProject(state, project);
      const myTasks = state.tasks.filter(
        (task) =>
          task.projectId === project.id &&
          task.status !== "completed" &&
          task.status !== "split" &&
          task.status !== "archived",
      );
      const board = buildProgressBoard(state, project.id);

      return {
        projectId: project.id,
        workspaceId,
        workspaceName: workspace?.name,
        workspaceType: workspace?.type,
        name: project.name,
        description: project.description,
        progressPercent: board.projectProgress,
        myTaskCount: myTasks.length,
        inProgressCount: myTasks.filter((task) => task.status === "in_progress").length,
        pendingReviewCount: myTasks.filter((task) => task.status === "pending_review").length,
        poolCount: myTasks.filter((task) => task.status === "pool").length,
        committedCount: myTasks.filter((task) => task.status === "committed").length,
      };
    });
};
