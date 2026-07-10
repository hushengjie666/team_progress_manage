import type { TaskStatus } from "../../src/types.js";
import {
  assignTaskInTeamState,
  createTaskInTeamState,
  deleteTaskInTeamState,
  setTaskStatusInTeamState,
  splitTaskInTeamState,
  updateTaskInTeamState,
  updateTaskProgressInTeamState,
} from "./businessTaskOperations.js";
import type { TaskAssignmentInput, TaskInput, TaskUpdateInput } from "./businessTypes.js";
import { TimeManageProjectClient } from "./clientProjects.js";
import { requireConfirmation } from "./confirmation.js";
import { compactTask, listTaskViews, taskDetailView, type TaskListFilter } from "./views.js";

export class TimeManageTaskClient extends TimeManageProjectClient {
  async listTasks(filter: TaskListFilter = {}) {
    return listTaskViews(await this.authenticatedState(), filter);
  }

  async getTask(taskId: string) {
    return taskDetailView(await this.authenticatedState(), taskId);
  }

  async createTask(input: TaskInput) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
      const next = createTaskInTeamState(state, input, timestamp);
      const task = next.tasks.find((item) => !state.tasks.some((existing) => existing.id === item.id));
      return { state: next, result: task?.id };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result)!);
  }

  async batchCreateTasks(projectId: string, tasks: Array<Omit<TaskInput, "projectId">>) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      let next = state;
      const createdIds: string[] = [];
      for (const task of tasks) {
        const beforeIds = new Set(next.tasks.map((item) => item.id));
        next = createTaskInTeamState(next, { ...task, projectId }, timestamp);
        const created = next.tasks.find((item) => !beforeIds.has(item.id));
        if (created) createdIds.push(created.id);
      }
      return { state: next, result: createdIds };
    });
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!));
  }

  async updateTask(taskId: string, input: TaskUpdateInput) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: updateTaskInTeamState(state, taskId, input, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async deleteTask(taskId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_task");
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: deleteTaskInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return { deletedTaskId: taskId, savedAt: saved.savedAt };
  }

  async assignTask(taskId: string, assignment: TaskAssignmentInput) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: assignTaskInTeamState(state, taskId, assignment, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async batchAssignTasks(taskIds: string[], assignment: TaskAssignmentInput) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: taskIds.reduce((current, taskId) => assignTaskInTeamState(current, taskId, assignment, timestamp), state),
      result: taskIds,
    }));
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!));
  }

  async setTaskStatus(taskId: string, status: TaskStatus, confirmed?: boolean) {
    if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, "set_task_status");
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: setTaskStatusInTeamState(state, taskId, status, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async updateTaskProgress(taskId: string, progressPercent: number, progressNote = "") {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: updateTaskProgressInTeamState(state, taskId, progressPercent, progressNote, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async splitTask(taskId: string, childTitles: string[], confirmed?: boolean) {
    requireConfirmation(confirmed, "split_task");
    const saved = await this.mutate(undefined, (state, timestamp) => {
      const next = splitTaskInTeamState(state, taskId, childTitles, timestamp);
      return { state: next, result: next.tasks.filter((task) => !state.tasks.some((existing) => existing.id === task.id)).map((task) => task.id) };
    });
    return saved.result.map((id) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === id)!));
  }
}
