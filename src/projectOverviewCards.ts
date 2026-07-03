import {
  countProjectAccessibleMembers,
  visibleProjectsForAccount,
  workspaceForProject,
  workspaceIdForProject,
} from "./accessControl";
import { buildProgressBoard } from "./progressBoard";
import type { ProjectOverviewCard } from "./projectOverviewTypes";
import type { AppState, Project, TaskStatus } from "./types";

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
