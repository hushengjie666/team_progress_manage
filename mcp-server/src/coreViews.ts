import { todayKey } from "../../src/seed.js";
import { dailySummaryView, todayPlanView, todayWorkbenchView, updateDailyReviewMutation } from "./coreDailyViews.js";
import { TimeManageMcpMemberClient } from "./coreMembers.js";
import { activeWorkView, listTaskViews, projectOverviewView, riskTasksView, taskDetailView } from "./coreProjectViews.js";
import type { DailyReviewPatch, TaskListFilter } from "./coreTypes.js";

export class TimeManageMcpViewClient extends TimeManageMcpMemberClient {
  async listTasks(filter: TaskListFilter) {
    const state = await this.readState(filter.projectId);
    return listTaskViews(state, filter);
  }

  async getTask(taskId: string) {
    const state = await this.readState();
    return taskDetailView(state, taskId);
  }

  async getTodayPlan() {
    const state = await this.readState();
    return todayPlanView(state, todayKey());
  }

  async getTodayWorkbench(projectId?: string) {
    const state = await this.readState(projectId);
    return todayWorkbenchView(state, projectId, todayKey());
  }

  async getActiveWork(projectId?: string) {
    const state = await this.readState(projectId);
    return activeWorkView(state, projectId);
  }

  async getProjectOverview(projectId: string) {
    const state = await this.readState(projectId);
    return projectOverviewView(state, projectId);
  }

  async listPendingReviews(projectId?: string) {
    return this.listTasks({ projectId, status: "pending_review", includeArchived: false, includeSplit: false });
  }

  async listRiskTasks(projectId?: string) {
    const state = await this.readState(projectId);
    return riskTasksView(state, projectId);
  }

  async getDailySummary(date = todayKey()) {
    const state = await this.readState();
    return dailySummaryView(state, date);
  }

  async updateDailyReview(date: string, patch: DailyReviewPatch) {
    return this.mutate(undefined, (state, timestamp) => updateDailyReviewMutation(state, date, patch, timestamp));
  }
}
