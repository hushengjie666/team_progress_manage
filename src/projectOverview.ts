import { buildProgressBoard } from "./domain";
import {
  projectMemberIdentityIds,
  sameMemberIdentity,
  taskAssignedToMemberIdentity,
  taskBelongsToMemberIdentity,
} from "./memberIdentity";
import type { AppState, Project, ProjectMember, Task, TaskStatus } from "./types";

export { projectMemberIdentityIds, sameMemberIdentity, taskAssignedToMemberIdentity } from "./memberIdentity";

export type ProjectOverviewCard = {
  projectId: string;
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

export const buildProjectOverviewCards = (state: AppState): ProjectOverviewCard[] =>
  [...state.projects].sort(compareProjectsForOverview).map((project) => {
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
      name: project.name,
      description: project.description,
      progressPercent: board.projectProgress,
      memberCount: state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled").length,
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
  const memberIds = projectMemberIdentityIds(state, currentMember);
  if (memberIds.size === 0) return [];
  const selectedProjects = selectedProjectIds.length > 0
    ? new Set(selectedProjectIds)
    : new Set(
        state.projectMembers
          .filter((member) => member.status !== "disabled" && currentMember && sameMemberIdentity(member, currentMember))
          .map((member) => member.projectId),
      );
  return state.tasks.filter(
    (task) =>
      selectedProjects.has(task.projectId) &&
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived" &&
      taskBelongsToMemberIdentity(state, task, memberIds),
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
  const memberIds = projectMemberIdentityIds(state, currentMember);
  if (memberIds.size === 0) return [];
  const participatingProjectIds = new Set(
    state.projectMembers
      .filter((member) => member.status !== "disabled" && memberIds.has(member.id))
      .map((member) => member.projectId),
  );

  return state.projects
    .filter((project) => participatingProjectIds.has(project.id))
    .map((project) => {
      const myTasks = state.tasks.filter(
        (task) =>
          task.projectId === project.id &&
          task.status !== "completed" &&
          task.status !== "split" &&
          task.status !== "archived" &&
          taskBelongsToMemberIdentity(state, task, memberIds),
      );
      const board = buildProgressBoard(state, project.id);

      return {
        projectId: project.id,
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
