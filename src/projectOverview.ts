import {
  accessibleProjectIdsForCurrentUser,
  countProjectAccessibleMembers,
  projectMemberIdentityIds,
  sameMemberIdentity,
  taskAssignedToMemberIdentity,
  taskBelongsToMemberIdentity,
  visibleProjectsForAccount,
  workspaceForProject,
  workspaceIdForProject,
} from "./accessControl";
import { buildProgressBoard } from "./progressBoard";
import type { AppState, Project, ProjectMember, Task, TaskStatus } from "./types";

export {
  accessibleProjectIdsForCurrentUser,
  activeWorkspaceIdsForCurrentAccount,
  projectMemberIdentityIds,
  sameMemberIdentity,
  taskAssignedToMemberIdentity,
  workspaceForProject,
  workspaceIdForProject,
  workspaceMembershipsForState,
} from "./accessControl";

export type ProjectOverviewCard = {
  projectId: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: "private" | "shared";
  name: string;
  description: string;
  progressPercent: number;
  memberCount: number;
  taskCount: number;
  activeSessionCount: number;
  inProgressCount: number;
  pendingReviewCount: number;
  riskCount: number;
  assignedNotStartedCount: number;
  statusCounts: Record<TaskStatus, number>;
};

export type MyProjectTaskCard = {
  projectId: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceType?: "private" | "shared";
  name: string;
  description: string;
  progressPercent: number;
  myTaskCount: number;
  inProgressCount: number;
  pendingReviewCount: number;
  poolCount: number;
  committedCount: number;
};

const emptyStatusCounts = (): Record<TaskStatus, number> => ({
  pool: 0,
  committed: 0,
  in_progress: 0,
  pending_review: 0,
  completed: 0,
  split: 0,
  archived: 0,
});

const projectCreatedAtRank = (project: Project) => {
  const value = new Date(project.createdAt).getTime();
  return Number.isFinite(value) ? value : 0;
};

export const projectOverviewSortOrder = (project: Project) =>
  Number.isFinite(project.sortOrder) ? project.sortOrder! : projectCreatedAtRank(project);

export const compareProjectsForOverview = (left: Project, right: Project) =>
  projectOverviewSortOrder(left) - projectOverviewSortOrder(right) ||
  projectCreatedAtRank(left) - projectCreatedAtRank(right) ||
  left.id.localeCompare(right.id);

const visibleProjectsForOverview = (state: AppState) => {
  return visibleProjectsForAccount(state);
};

export const buildProjectOverviewCards = (state: AppState): ProjectOverviewCard[] =>
  [...visibleProjectsForOverview(state)].sort(compareProjectsForOverview).map((project) => {
    const workspace = workspaceForProject(state, project);
    const workspaceId = workspaceIdForProject(state, project);
    const tasks = state.tasks.filter((task) => task.projectId === project.id);
    const statusCounts = tasks.reduce<Record<TaskStatus, number>>((counts, task) => {
      counts[task.status] += 1;
      return counts;
    }, emptyStatusCounts());
    const board = buildProgressBoard(state, project.id);
    const riskCount = board.sections
      .filter((section) => section.kind !== "normal")
      .reduce((sum, section) => sum + section.tasks.length, 0);
    const assignedNotStartedCount = board.sections.find((section) => section.kind === "assigned_not_started")?.tasks.length ?? 0;

    return {
      projectId: project.id,
      workspaceId,
      workspaceName: workspace?.name,
      workspaceType: workspace?.type,
      name: project.name,
      description: project.description,
      progressPercent: board.projectProgress,
      memberCount: countProjectAccessibleMembers(state, project, workspaceId),
      taskCount: tasks.length,
      activeSessionCount: board.activeSessions.length,
      inProgressCount: statusCounts.in_progress,
      pendingReviewCount: statusCounts.pending_review,
      riskCount,
      assignedNotStartedCount,
      statusCounts,
    };
  });

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
  if (memberIds.size === 0) return [];
  return tasks.filter((task) => taskBelongsToMemberIdentity(state, task, memberIds, options));
};

export const filterTodayCompletedTasksForMember = (
  state: AppState,
  date: string,
  currentMember: ProjectMember | undefined,
  options: { includeProjectOwnerUnassigned?: boolean; includeUnassigned?: boolean } = {},
) => {
  const memberIds = projectMemberIdentityIds(state, currentMember);
  if (memberIds.size === 0) return [];
  return state.tasks.filter(
    (task) =>
      task.status === "completed" &&
      task.completedAt?.slice(0, 10) === date &&
      taskBelongsToMemberIdentity(state, task, memberIds, options),
  );
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
