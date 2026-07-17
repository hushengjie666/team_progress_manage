import type { Settings } from "../../src/types.js";
import { today } from "../../src/appModel.js";
import { currentAccountDailyPlanForWorkspaceDate, dailyPlanIdForDate, workspaceIdForTask } from "../../src/dailyPlanScope.js";
import {
  instantiateTaskTemplateInTeamState,
  recordInterruptionInTeamState,
  saveTaskTemplateInTeamState,
  updateDailyReviewInTeamState,
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
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const workspaceId = workspaceIdForTask(state, task);
    const date = today();
    const planId = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date)?.id ?? dailyPlanIdForDate(state, date, workspaceId);
    const saved = await this.runBusinessCommand({ kind: "action", resource: "daily-plans", id: planId, action: "add-task", workspaceId, payload: { task_id: taskId, date } });
    return dailyPlanView(saved.state);
  }

  async batchAddTasksToToday(taskIds: string[]) {
    for (const taskId of taskIds) await this.addTaskToToday(taskId);
    return dailyPlanView(await this.authenticatedState());
  }

  async removeTaskFromToday(taskId: string) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const workspaceId = workspaceIdForTask(state, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, today());
    if (!plan) return dailyPlanView(state);
    const saved = await this.runBusinessCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "remove-task", workspaceId, payload: { task_id: taskId } });
    return dailyPlanView(saved.state);
  }

  async moveTodayTask(taskId: string, direction: -1 | 1) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const workspaceId = workspaceIdForTask(state, task);
    const plan = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, today());
    if (!plan) return dailyPlanView(state);
    const saved = await this.runBusinessCommand({ kind: "action", resource: "daily-plans", id: plan.id, action: "move-task", workspaceId, payload: { task_id: taskId, direction } });
    return dailyPlanView(saved.state);
  }

  async scheduleTaskForDate(taskId: string, date: string) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const workspaceId = workspaceIdForTask(state, task);
    const planId = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date)?.id ?? dailyPlanIdForDate(state, date, workspaceId);
    const saved = await this.runBusinessCommand({ kind: "action", resource: "daily-plans", id: planId, action: "add-task", workspaceId, payload: { task_id: taskId, date } });
    return dailyPlanView(saved.state, date);
  }

  async startTask(taskId: string) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "action", resource: "tasks", id: taskId, action: "start", workspaceId: workspaceIdForTask(state, task), idempotencyKey: `cli-start-${taskId}-${Date.now()}` });
    return activeWorkView(saved.state);
  }

  async pauseWorkSession(input: WorkSessionInput) {
    const state = await this.authenticatedState();
    const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : state.workSessions.find((item) => item.status === "active");
    if (!session) throw new Error("Active work session not found.");
    const saved = await this.runBusinessCommand({ kind: "action", resource: "work-sessions", id: session.id, action: "pause", workspaceId: session.workspaceId, idempotencyKey: `cli-pause-${session.id}-${Date.now()}` });
    return activeWorkView(saved.state);
  }

  async resumeWorkSession(input: WorkSessionInput) {
    const state = await this.authenticatedState();
    const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : state.workSessions.find((item) => item.status === "paused");
    if (!session) throw new Error("Paused work session not found.");
    const saved = await this.runBusinessCommand({ kind: "action", resource: "work-sessions", id: session.id, action: "resume", workspaceId: session.workspaceId, idempotencyKey: `cli-resume-${session.id}-${Date.now()}` });
    return activeWorkView(saved.state);
  }

  async finishWorkSession(input: WorkSessionInput) {
    const state = await this.authenticatedState();
    const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : state.workSessions.find((item) => item.status === "active" || item.status === "paused");
    if (!session) throw new Error("Active work session not found.");
    const saved = await this.runBusinessCommand({ kind: "action", resource: "work-sessions", id: session.id, action: "finish", workspaceId: session.workspaceId, payload: { outcome: input.outcome }, idempotencyKey: `cli-finish-${session.id}-${Date.now()}` });
    return activeWorkView(saved.state);
  }

  async getActiveWork(projectId?: string) {
    return activeWorkView(await this.authenticatedState(), projectId);
  }

  async recordInterruption(input: Parameters<typeof recordInterruptionInTeamState>[1]) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = recordInterruptionInTeamState(state, input, timestamp);
      return { state: next, result: next.interruptions[0]?.id };
    });
    const interruption = prepared.output.state.interruptions.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({ kind: "create", entity: "interruption", workspaceId: interruption.workspaceId, payload: interruption as unknown as Record<string, unknown> });
    return saved.state.interruptions.find((item) => item.id === interruption.id);
  }

  async submitTaskReview(taskId: string) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "action", resource: "tasks", id: taskId, action: "submit-review", workspaceId: workspaceIdForTask(state, task), idempotencyKey: `cli-submit-review-${taskId}-${Date.now()}` });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async acceptTaskReview(taskId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "accept_task_review");
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "action", resource: "tasks", id: taskId, action: "accept-review", workspaceId: workspaceIdForTask(state, task), idempotencyKey: `cli-accept-review-${taskId}-${Date.now()}` });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)!);
  }

  async returnTaskReview(taskId: string, reason: string) {
    const state = await this.authenticatedState();
    const task = state.tasks.find((item) => item.id === taskId)!;
    const saved = await this.runBusinessCommand({ kind: "action", resource: "tasks", id: taskId, action: "return-review", workspaceId: workspaceIdForTask(state, task), payload: { reason }, idempotencyKey: `cli-return-review-${taskId}-${Date.now()}` });
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
    const prepared = await this.prepareMutation((state, timestamp) => ({
      state: updateDailyReviewInTeamState(state, input, timestamp), result: input.date ?? today(),
    }));
    const plan = currentAccountDailyPlanForWorkspaceDate(prepared.output.state, input.workspaceId ?? prepared.before.auth.workspace?.id, prepared.output.result)!;
    const existing = prepared.before.dailyPlans.some((item) => item.id === plan.id);
    const saved = await this.runBusinessCommand(existing
      ? { kind: "patch", entity: "daily_plan", id: plan.id, workspaceId: plan.workspaceId, patch: plan as unknown as Record<string, unknown> }
      : { kind: "create", entity: "daily_plan", workspaceId: plan.workspaceId, payload: plan as unknown as Record<string, unknown> });
    return dailySummaryView(saved.state, prepared.output.result);
  }

  async getSettings() {
    return (await this.authenticatedState()).settings;
  }

  async updateSettings(input: Partial<Settings>) {
    const saved = await this.runBusinessCommand({ kind: "settings", patch: input as Record<string, unknown> });
    return saved.state.settings;
  }

  async listTaskTemplates() {
    const state = await this.authenticatedState();
    return state.taskTemplates;
  }

  async saveTaskTemplate(input: Parameters<typeof saveTaskTemplateInTeamState>[1]) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = saveTaskTemplateInTeamState(state, input, timestamp);
      return { state: next, result: input.id ?? next.taskTemplates[0]?.id };
    });
    const template = prepared.output.state.taskTemplates.find((item) => item.id === prepared.output.result)!;
    const exists = prepared.before.taskTemplates.some((item) => item.id === template.id);
    const saved = await this.runBusinessCommand(exists
      ? { kind: "patch", entity: "task_template", id: template.id, workspaceId: prepared.before.auth.workspace?.id, patch: template as unknown as Record<string, unknown> }
      : { kind: "create", entity: "task_template", workspaceId: prepared.before.auth.workspace?.id, payload: template as unknown as Record<string, unknown> });
    return saved.state.taskTemplates.find((item) => item.id === template.id);
  }

  async deleteTaskTemplate(templateId: string, confirmed?: boolean) {
    requireConfirmation(confirmed, "delete_task_template");
    const state = await this.authenticatedState();
    const saved = await this.runBusinessCommand({ kind: "delete", entity: "task_template", id: templateId, workspaceId: state.auth.workspace?.id });
    return { deletedTemplateId: templateId, savedAt: saved.savedAt };
  }

  async instantiateTaskTemplate(templateId: string, projectId: string) {
    const prepared = await this.prepareMutation((state, timestamp) => {
      const next = instantiateTaskTemplateInTeamState(state, templateId, projectId, timestamp);
      const taskId = next.templateInstances[0]?.taskId;
      return { state: next, result: taskId };
    });
    const task = prepared.output.state.tasks.find((item) => item.id === prepared.output.result)!;
    const saved = await this.runBusinessCommand({
      kind: "action",
      resource: "task-templates",
      id: templateId,
      action: "instantiate",
      workspaceId: task.workspaceId,
      payload: { task: task as unknown as Record<string, unknown> },
      idempotencyKey: `cli-template-${templateId}-${task.id}`,
    });
    return compactTask(saved.state, saved.state.tasks.find((item) => item.id === task.id)!);
  }
}
