import { createDailyPlanForDate, today } from "../../src/appModel.js";
import { currentAccountDailyPlanForWorkspaceDate, currentDailyPlanWorkspaceId, workspaceIdForTask } from "../../src/dailyPlanScope.js";
import { resolveMemberIdForProject } from "../../src/memberIdentity.js";
import { createProjectTaskInState } from "../../src/projectDetail.js";
import { uid } from "../../src/seed.js";
import {
  acceptTaskInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
} from "../../src/teamProgress.js";
import type { AppState, Settings, TaskTemplate } from "../../src/types.js";
import { requireTask } from "./businessGuards.js";
import type { InterruptionInput } from "./businessTypes.js";

export const submitTaskReviewInTeamState = (state: AppState, taskId: string, timestamp: string) => {
  const task = requireTask(state, taskId);
  return submitTaskForReviewInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};

export const acceptTaskReviewInTeamState = (state: AppState, taskId: string, timestamp: string) => {
  const task = requireTask(state, taskId);
  return acceptTaskInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};

export const returnTaskReviewInTeamState = (state: AppState, taskId: string, reason: string, timestamp: string) => {
  const task = requireTask(state, taskId);
  return returnTaskForReviewInState(state, taskId, reason, resolveMemberIdForProject(state, task.projectId), timestamp);
};

export const recordInterruptionInTeamState = (state: AppState, input: InterruptionInput, timestamp: string) => {
  const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : undefined;
  const taskId = input.taskId ?? session?.taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : undefined;
  return {
    ...state,
    interruptions: [
      {
        id: uid("interruption"),
        workspaceId: task ? workspaceIdForTask(state, task) : state.auth.workspace?.id,
        sessionId: input.workSessionId,
        taskId,
        type: input.type,
        note: input.note?.trim() ?? "",
        action: input.action ?? "defer",
        createdAt: timestamp,
      },
      ...state.interruptions,
    ],
    updatedAt: timestamp,
  };
};

export const updateDailyReviewInTeamState = (
  state: AppState,
  input: {
    date?: string;
    workspaceId?: string;
    reflection?: string;
    capacityPomodoros?: number;
    mood?: "low" | "normal" | "good" | "great";
    wins?: string;
    blockers?: string;
    interruptionPattern?: string;
    tomorrowFocus?: string;
  },
  timestamp: string,
) => {
  const date = input.date ?? today();
  const workspaceId = input.workspaceId ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? createDailyPlanForDate(state, date, timestamp, workspaceId);
  const nextPlan = {
    ...plan,
    reflection: input.reflection ?? plan.reflection,
    capacityPomodoros: input.capacityPomodoros === undefined ? plan.capacityPomodoros : Math.max(1, Math.round(input.capacityPomodoros)),
    review: {
      ...plan.review,
      mood: input.mood ?? plan.review.mood,
      wins: input.wins ?? plan.review.wins,
      blockers: input.blockers ?? plan.review.blockers,
      interruptionPattern: input.interruptionPattern ?? plan.review.interruptionPattern,
      tomorrowFocus: input.tomorrowFocus ?? plan.review.tomorrowFocus,
    },
    reviewedAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    ...state,
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp,
  };
};

export const updateSettingsInTeamState = (state: AppState, input: Partial<Settings>, timestamp: string) => ({
  ...state,
  settings: {
    ...state.settings,
    ...input,
    focusMinutes: input.focusMinutes === undefined ? state.settings.focusMinutes : Math.max(1, Math.round(input.focusMinutes)),
    shortBreakMinutes: input.shortBreakMinutes === undefined ? state.settings.shortBreakMinutes : Math.max(1, Math.round(input.shortBreakMinutes)),
    longBreakMinutes: input.longBreakMinutes === undefined ? state.settings.longBreakMinutes : Math.max(1, Math.round(input.longBreakMinutes)),
    longBreakEvery: input.longBreakEvery === undefined ? state.settings.longBreakEvery : Math.max(1, Math.round(input.longBreakEvery)),
    whiteNoiseVolume: input.whiteNoiseVolume === undefined ? state.settings.whiteNoiseVolume : Math.min(100, Math.max(0, Math.round(input.whiteNoiseVolume))),
  },
  updatedAt: timestamp,
});

export const saveTaskTemplateInTeamState = (state: AppState, input: Omit<TaskTemplate, "id"> & { id?: string }, timestamp: string) => {
  const template: TaskTemplate = {
    id: input.id?.trim() || uid("template"),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    project: input.project?.trim() ?? "",
    tags: input.tags ?? [],
    priority: input.priority,
    severity: input.severity,
    stage: input.stage,
    estimatePomodoros: Math.max(1, Math.round(input.estimatePomodoros)),
    subtasks: input.subtasks ?? [],
    repeatRule: input.repeatRule,
  };
  return {
    ...state,
    taskTemplates: state.taskTemplates.some((item) => item.id === template.id)
      ? state.taskTemplates.map((item) => item.id === template.id ? template : item)
      : [template, ...state.taskTemplates],
    updatedAt: timestamp,
  };
};

export const deleteTaskTemplateInTeamState = (state: AppState, templateId: string, timestamp: string) => ({
  ...state,
  taskTemplates: state.taskTemplates.filter((item) => item.id !== templateId),
  templateInstances: state.templateInstances.filter((item) => item.templateId !== templateId),
  updatedAt: timestamp,
});

export const instantiateTaskTemplateInTeamState = (state: AppState, templateId: string, projectId: string, timestamp: string) => {
  const template = state.taskTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Task template not found: ${templateId}`);
  const beforeTaskIds = new Set(state.tasks.map((task) => task.id));
  const next = createProjectTaskInState(state, projectId, {
    title: template.name,
    notes: template.description,
    tags: template.tags,
    priority: template.priority,
    severity: template.severity,
    stage: template.stage,
    estimatePomodoros: template.estimatePomodoros,
    repeatRule: template.repeatRule,
    subtasks: template.subtasks,
  }, timestamp, uid);
  const task = next.tasks.find((item) => !beforeTaskIds.has(item.id));
  if (!task) throw new Error("Task template was not instantiated.");
  return {
    ...next,
    templateInstances: [{ templateId, taskId: task.id, createdAt: timestamp }, ...next.templateInstances],
    updatedAt: timestamp,
  };
};
