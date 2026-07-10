import type { Settings } from "../../src/types.js";
import {
  addTaskToTodayInTeamState,
  batchAddTasksToTodayInTeamState,
  finishWorkSessionInTeamState,
  moveTodayTaskInTeamState,
  pauseWorkSessionInTeamState,
  removeTaskFromTodayInTeamState,
  resumeWorkSessionInTeamState,
  scheduleTaskForDateInState,
  startTaskInTeamState,
} from "./businessTaskOperations.js";
import {
  acceptTaskReviewInTeamState,
  deleteTaskTemplateInTeamState,
  instantiateTaskTemplateInTeamState,
  recordInterruptionInTeamState,
  returnTaskReviewInTeamState,
  saveTaskTemplateInTeamState,
  submitTaskReviewInTeamState,
  updateDailyReviewInTeamState,
  updateSettingsInTeamState,
} from "./businessReviewSettingsOperations.js";
import type { WorkSessionInput } from "./businessTypes.js";
import { TimeManageTaskClient } from "./clientTasks.js";
import { requireConfirmation } from "./confirmation.js";
import {
  activeWorkView,
  compactTask,
  dailyPlanView,
  dailySummaryView,
  todayWorkbenchView,
} from "./views.js";

export class TimeManageWorkflowClient extends TimeManageTaskClient {
  async getTodayPlan(date?: string) {
    return dailyPlanView(await this.authenticatedState(), date);
  }

  async getTodayWorkbench(projectId?: string, date?: string) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }

  async addTaskToToday(taskId: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: addTaskToTodayInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return dailyPlanView(saved.state);
  }

  async batchAddTasksToToday(taskIds: string[]) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: batchAddTasksToTodayInTeamState(state, taskIds, timestamp),
      result: taskIds,
    }));
    return dailyPlanView(saved.state);
  }

  async removeTaskFromToday(taskId: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: removeTaskFromTodayInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return dailyPlanView(saved.state);
  }

  async moveTodayTask(taskId: string, direction: -1 | 1) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: moveTodayTaskInTeamState(state, taskId, direction, timestamp),
      result: taskId,
    }));
    return dailyPlanView(saved.state);
  }

  async scheduleTaskForDate(taskId: string, date: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: scheduleTaskForDateInState(state, taskId, date, timestamp),
      result: taskId,
    }));
    return dailyPlanView(saved.state, date);
  }

  async startTask(taskId: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: startTaskInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return activeWorkView(saved.state);
  }

  async pauseWorkSession(input: WorkSessionInput) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: pauseWorkSessionInTeamState(state, input, timestamp),
      result: input,
    }));
    return activeWorkView(saved.state);
  }

  async resumeWorkSession(input: WorkSessionInput) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: resumeWorkSessionInTeamState(state, input, timestamp),
      result: input,
    }));
    return activeWorkView(saved.state);
  }

  async finishWorkSession(input: WorkSessionInput) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: finishWorkSessionInTeamState(state, input, timestamp),
      result: input,
    }));
    return activeWorkView(saved.state);
  }

  async getActiveWork(projectId?: string) {
    return activeWorkView(await this.authenticatedState(), projectId);
  }

  async recordInterruption(input: Parameters<typeof recordInterruptionInTeamState>[1]) {
    const saved = await this.mutate(undefined, (state, timestamp) => {
      const next = recordInterruptionInTeamState(state, input, timestamp);
      return { state: next, result: next.interruptions[0]?.id };
    });
    return saved.state.interruptions.find((item) => item.id === saved.result);
  }

  async submitTaskReview(taskId: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: submitTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async acceptTaskReview(taskId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "accept_task_review");
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: acceptTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async returnTaskReview(taskId: string, reason: string) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: returnTaskReviewInTeamState(state, taskId, reason, timestamp),
      result: taskId,
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async listPendingReviews(projectId?: string) {
    return this.listTasks({ projectId, status: "pending_review", includeArchived: false, includeSplit: false });
  }

  async getMemberStatus(projectId?: string, date?: string) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }

  async getDailySummary(date?: string) {
    return dailySummaryView(await this.authenticatedState(), date);
  }

  async updateDailyReview(input: Parameters<typeof updateDailyReviewInTeamState>[1]) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: updateDailyReviewInTeamState(state, input, timestamp),
      result: input.date,
    }));
    return dailySummaryView(saved.state, input.date);
  }

  async getSettings() {
    return (await this.authenticatedState()).settings;
  }

  async updateSettings(input: Partial<Settings>) {
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: updateSettingsInTeamState(state, input, timestamp),
      result: undefined,
    }));
    return saved.state.settings;
  }

  async listTaskTemplates() {
    const state = await this.authenticatedState();
    return state.taskTemplates;
  }

  async saveTaskTemplate(input: Parameters<typeof saveTaskTemplateInTeamState>[1]) {
    const saved = await this.mutate(undefined, (state, timestamp) => {
      const next = saveTaskTemplateInTeamState(state, input, timestamp);
      return { state: next, result: input.id ?? next.taskTemplates[0]?.id };
    });
    return saved.state.taskTemplates.find((template) => template.id === saved.result);
  }

  async deleteTaskTemplate(templateId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_task_template");
    const saved = await this.mutate(undefined, (state, timestamp) => ({
      state: deleteTaskTemplateInTeamState(state, templateId, timestamp),
      result: templateId,
    }));
    return { deletedTemplateId: templateId, savedAt: saved.savedAt };
  }

  async instantiateTaskTemplate(templateId: string, projectId: string) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = instantiateTaskTemplateInTeamState(state, templateId, projectId, timestamp);
      const taskId = next.templateInstances[0]?.taskId;
      return { state: next, result: taskId };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result)!);
  }
}
