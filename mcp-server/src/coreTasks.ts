import type { ProjectTaskInput } from "../../src/projectDetail.js";
import type { TaskStatus } from "../../src/types.js";
import { TimeManageMcpViewClient } from "./coreViews.js";
import type { CreateTaskInput, UpdateTaskInput } from "./coreTypes.js";
import type { TaskAssignment, WorkSessionMutationInput } from "./coreTaskMutationTypes.js";
import {
  assignTaskMutation,
  batchAssignTasksMutation,
  setTaskStatusMutation,
  updateTaskProgressMutation,
} from "./coreTaskAssignmentMutations.js";
import {
  batchCreateTasksMutation,
  createTaskMutation,
} from "./coreTaskCreationMutations.js";
import {
  deleteTaskMutation,
  splitTaskMutation,
  updateTaskMutation,
} from "./coreTaskEditingMutations.js";
import {
  acceptTaskReviewMutation,
  returnTaskReviewMutation,
  submitTaskReviewMutation,
} from "./coreTaskReviewMutations.js";
import {
  addTaskToTodayMutation,
  batchAddTasksToTodayMutation,
  removeTaskFromTodayMutation,
} from "./coreTodayQueueMutations.js";
import {
  finishWorkSessionMutation,
  pauseWorkSessionMutation,
  resumeWorkSessionMutation,
  startTaskMutation,
} from "./coreWorkSessionMutations.js";

export class TimeManageMcpTaskClient extends TimeManageMcpViewClient {
  async createTask(input: CreateTaskInput) {
    return this.mutate(input.projectId, (state, timestamp) => createTaskMutation(state, input, timestamp));
  }

  async updateTask(taskId: string, input: UpdateTaskInput) {
    return this.mutate(undefined, (state, timestamp) => updateTaskMutation(state, taskId, input, timestamp));
  }

  async batchCreateTasks(projectId: string, tasks: Array<Omit<ProjectTaskInput, "projectId"> & { title: string }>) {
    return this.mutate(projectId, (state, timestamp) => batchCreateTasksMutation(state, projectId, tasks, timestamp));
  }

  async batchAssignTasks(taskIds: string[], assignment: TaskAssignment) {
    return this.mutate(assignment.projectId, (state, timestamp) => batchAssignTasksMutation(state, taskIds, assignment, timestamp));
  }

  async batchAddTasksToToday(taskIds: string[]) {
    return this.mutate(undefined, (state, timestamp) => batchAddTasksToTodayMutation(state, taskIds, timestamp));
  }

  async splitTask(taskId: string, childTitles: string[]) {
    return this.mutate(undefined, (state, timestamp) => splitTaskMutation(state, taskId, childTitles, timestamp));
  }

  async deleteTask(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => deleteTaskMutation(state, taskId, timestamp));
  }

  async assignTask(taskId: string, assignment: TaskAssignment) {
    return this.mutate(assignment.projectId, (state, timestamp) => assignTaskMutation(state, taskId, assignment, timestamp));
  }

  async setTaskStatus(taskId: string, status: TaskStatus) {
    return this.mutate(undefined, (state, timestamp) => setTaskStatusMutation(state, taskId, status, timestamp));
  }

  async updateTaskProgress(taskId: string, progressPercent: number, progressNote = "") {
    return this.mutate(undefined, (state, timestamp) => updateTaskProgressMutation(state, taskId, progressPercent, progressNote, timestamp));
  }

  async addTaskToToday(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => addTaskToTodayMutation(state, taskId, timestamp));
  }

  async removeTaskFromToday(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => removeTaskFromTodayMutation(state, taskId, timestamp));
  }

  async startTask(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => startTaskMutation(state, taskId, timestamp));
  }

  async pauseWorkSession(input: WorkSessionMutationInput) {
    return this.mutate(undefined, (state, timestamp) => pauseWorkSessionMutation(state, timestamp, input));
  }

  async resumeWorkSession(input: WorkSessionMutationInput) {
    return this.mutate(undefined, (state, timestamp) => resumeWorkSessionMutation(state, timestamp, input));
  }

  async finishWorkSession(input: WorkSessionMutationInput) {
    return this.mutate(undefined, (state, timestamp) => finishWorkSessionMutation(state, timestamp, input));
  }

  async submitTaskReview(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => submitTaskReviewMutation(state, taskId, timestamp));
  }

  async acceptTaskReview(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => acceptTaskReviewMutation(state, taskId, timestamp));
  }

  async returnTaskReview(taskId: string, reason: string) {
    return this.mutate(undefined, (state, timestamp) => returnTaskReviewMutation(state, taskId, reason, timestamp));
  }
}
