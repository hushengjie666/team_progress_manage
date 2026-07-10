import type { AppState } from "../../src/types.js";

export const requireProject = (state: AppState, projectId: string) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
};

export const requireTask = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return task;
};

export const requireMember = (state: AppState, projectMemberId: string) => {
  const member = state.projectMembers.find((item) => item.id === projectMemberId);
  if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
  return member;
};
