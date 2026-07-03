import {
  assignTaskInState,
  updateTaskProgressInState,
} from "../../src/teamProgress.js";
import type { AppState, Task, TaskStatus } from "../../src/types.js";
import { compactTask } from "./coreTaskModel.js";
import type { TaskAssignment } from "./coreTaskMutationTypes.js";

export const batchAssignTasksMutation = (state: AppState, taskIds: string[], assignment: TaskAssignment, timestamp: string) => {
  let next = state;
  for (const taskId of taskIds) {
    next = assignTaskInState(next, taskId, assignment, timestamp);
  }
  return {
    state: next,
    result: taskIds
      .map((taskId) => next.tasks.find((task) => task.id === taskId))
      .filter((task): task is Task => Boolean(task))
      .map((task) => compactTask(next, task)),
  };
};

export const assignTaskMutation = (state: AppState, taskId: string, assignment: TaskAssignment, timestamp: string) => {
  const next = assignTaskInState(state, taskId, assignment, timestamp);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return { state: next, result: compactTask(next, task) };
};

export const setTaskStatusMutation = (state: AppState, taskId: string, status: TaskStatus, timestamp: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const next = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            status,
            progressPercent: status === "completed" ? 100 : item.progressPercent,
            completedAt: status === "completed" ? timestamp : item.completedAt,
            updatedAt: timestamp,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
  return { state: next, result: compactTask(next, next.tasks.find((item) => item.id === taskId)!) };
};

export const updateTaskProgressMutation = (state: AppState, taskId: string, progressPercent: number, progressNote: string, timestamp: string) => {
  const next = updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return { state: next, result: compactTask(next, task) };
};
