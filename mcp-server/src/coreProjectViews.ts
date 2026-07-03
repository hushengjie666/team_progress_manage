import { buildProgressBoard } from "../../src/domain.js";
import { projectMembersForProject } from "../../src/teamProgress.js";
import type { AppState } from "../../src/types.js";
import { sortedByUpdatedAt } from "../../src/workSessionTransitions.js";
import { memberLabel } from "./coreProjectModel.js";
import { activeWorkSessionsForTasks, compactTask, taskMatchesFilter } from "./coreTaskModel.js";
import type { TaskListFilter } from "./coreTypes.js";

export const listTaskViews = (state: AppState, filter: TaskListFilter) =>
  sortedByUpdatedAt(state.tasks.filter((task) => taskMatchesFilter(task, filter))).map((task) => compactTask(state, task));

export const taskDetailView = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const projectMembers = projectMembersForProject(state, task.projectId);
  const workSessions = state.workSessions.filter((session) => session.taskId === taskId);
  return { task, projectMembers, workSessions };
};

export const activeWorkView = (state: AppState, projectId?: string) => {
  const tasks = state.tasks.filter((task) => !projectId || task.projectId === projectId);
  return activeWorkSessionsForTasks(state, tasks).map((session) => {
    const task = state.tasks.find((item) => item.id === session.taskId);
    const executor = session.executorMemberId ? state.projectMembers.find((member) => member.id === session.executorMemberId) : undefined;
    return {
      ...session,
      task: task ? compactTask(state, task) : undefined,
      executorName: memberLabel(executor),
    };
  });
};

export const projectOverviewView = (state: AppState, projectId: string) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const tasks = state.tasks.filter((task) => task.projectId === projectId);
  const board = buildProgressBoard(state, projectId);
  return {
    project,
    progressPercent: board.projectProgress,
    activeSessions: board.activeSessions,
    sections: board.sections,
    counts: {
      total: tasks.length,
      pool: tasks.filter((task) => task.status === "pool").length,
      committed: tasks.filter((task) => task.status === "committed").length,
      inProgress: tasks.filter((task) => task.status === "in_progress").length,
      pendingReview: tasks.filter((task) => task.status === "pending_review").length,
      completed: tasks.filter((task) => task.status === "completed").length,
      archived: tasks.filter((task) => task.status === "archived").length,
    },
  };
};

export const riskTasksView = (state: AppState, projectId?: string) => {
  const projects = projectId
    ? state.projects.filter((project) => project.id === projectId)
    : state.projects.filter((project) => !project.archivedAt);
  return projects.flatMap((project) => {
    const board = buildProgressBoard(state, project.id);
    return board.sections
      .filter((section) => section.kind !== "normal")
      .flatMap((section) =>
        section.tasks.map((task) => ({
          projectId: project.id,
          projectName: project.name,
          riskKind: section.kind,
          riskTitle: section.title,
          ...task,
        })),
      );
  });
};
