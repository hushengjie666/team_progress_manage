import type { TaskStatus } from "../../src/types.js";
import {
  createTaskInTeamState,
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
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = createTaskInTeamState(state, input, timestamp);
      const task = next.tasks.find((item) => !state.tasks.some((existing) => existing.id === item.id));
      return { state: next, result: task?.id };
    });
    const task = prepared.output.state.tasks.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({ kind: "create", entity: "task", workspaceId: task.workspaceId, payload: task as unknown as Record<string, unknown> });
    return compactTask(saved.state, saved.state.tasks.find((item) => item.id === task.id)!);
  }

  async batchCreateTasks(projectId: string, tasks: Array<Omit<TaskInput, "projectId">>) {
    const created = [];
    for (const task of tasks) created.push(await this.createTask({ ...task, projectId }));
    return created;
  }

  async updateTask(taskId: string, input: TaskUpdateInput) {
    const current = (await this.authenticatedState()).tasks.find((task) => task.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: current.workspaceId, patch: input as Record<string, unknown> });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async deleteTask(taskId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_task");
    const current = (await this.authenticatedState()).tasks.find((task) => task.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "delete", entity: "task", id: taskId, workspaceId: current.workspaceId });
    return { deletedTaskId: taskId, savedAt: saved.savedAt };
  }

  async assignTask(taskId: string, assignment: TaskAssignmentInput) {
    const current = (await this.authenticatedState()).tasks.find((task) => task.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: current.workspaceId, patch: assignment as unknown as Record<string, unknown> });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async batchAssignTasks(taskIds: string[], assignment: TaskAssignmentInput) {
    const updated = [];
    for (const taskId of taskIds) updated.push(await this.assignTask(taskId, assignment));
    return updated;
  }

  async setTaskStatus(taskId: string, status: TaskStatus, confirmed?: boolean) {
    if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, "set_task_status");
    const current = (await this.authenticatedState()).tasks.find((task) => task.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: current.workspaceId, patch: { status } });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async updateTaskProgress(taskId: string, progressPercent: number, progressNote = "") {
    const current = (await this.authenticatedState()).tasks.find((task) => task.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: current.workspaceId, patch: { progressPercent, progressNote } });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async splitTask(taskId: string, childTitles: string[], confirmed?: boolean) {
    requireConfirmation(confirmed, "split_task");
    const state = await this.authenticatedState();
    const current = state.tasks.find((task) => task.id === taskId)!;
    const beforeIds = new Set(state.tasks.map((task) => task.id));
    const saved = await this.runBusinessCommand({ kind: "action", resource: "tasks", id: taskId, action: "split", workspaceId: current.workspaceId, payload: { child_titles: childTitles }, idempotencyKey: `cli-split-${taskId}-${Date.now()}` });
    return saved.state.tasks.filter((task) => !beforeIds.has(task.id)).map((task) => compactTask(saved.state, task));
  }
}
