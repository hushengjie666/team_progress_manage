import { createProjectTaskInState, type ProjectTaskInput } from "../../src/projectDetail.js";
import type { AppState } from "../../src/types.js";
import { compactTask } from "./coreTaskModel.js";
import type { CreateTaskInput } from "./coreTypes.js";

export const createTaskMutation = (state: AppState, input: CreateTaskInput, timestamp: string) => {
  const next = createProjectTaskInState(state, input.projectId, input, timestamp);
  const created = next.tasks.find((task) => !state.tasks.some((item) => item.id === task.id));
  if (!created) throw new Error("Task was not created. Check projectId and title.");
  return { state: next, result: compactTask(next, created) };
};

export const batchCreateTasksMutation = (
  state: AppState,
  projectId: string,
  tasks: Array<Omit<ProjectTaskInput, "projectId"> & { title: string }>,
  timestamp: string,
) => {
  let next = state;
  const createdIds: string[] = [];
  for (const input of tasks) {
    const beforeIds = new Set(next.tasks.map((task) => task.id));
    next = createProjectTaskInState(next, projectId, input, timestamp);
    const created = next.tasks.find((task) => !beforeIds.has(task.id));
    if (created) createdIds.push(created.id);
  }
  return {
    state: next,
    result: createdIds.map((id) => compactTask(next, next.tasks.find((task) => task.id === id)!)),
  };
};
