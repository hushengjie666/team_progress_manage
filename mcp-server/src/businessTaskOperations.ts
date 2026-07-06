import { createDailyPlanForDate, today } from "../../src/appModel.js";
import { deleteTaskFromState } from "../../src/appTaskDeletionState.js";
import { splitTaskInState } from "../../src/appTaskSplitState.js";
import { moveCommittedTaskInState, updateTaskInState } from "../../src/appTaskState.js";
import { removeTaskFromTodayInState } from "../../src/appTodayPlanState.js";
import {
  currentAccountDailyPlanForWorkspaceDate,
  currentDailyPlanWorkspaceId,
  workspaceIdForTask,
} from "../../src/dailyPlanScope.js";
import { createProjectTaskInState } from "../../src/projectDetail.js";
import { uid } from "../../src/seed.js";
import { assignTaskInState, updateTaskProgressInState } from "../../src/teamProgress.js";
import type { AppState, TaskStatus } from "../../src/types.js";
import {
  addTaskToTodayInState,
  finishWorkSessionInState,
  pauseWorkSessionInState,
  resumeWorkSessionInState,
  startWorkSessionInState,
} from "../../src/workSessionTransitions.js";
import { requireProject, requireTask } from "./businessGuards.js";
import type { TaskAssignmentInput, TaskInput, TaskUpdateInput, WorkSessionInput } from "./businessTypes.js";

export const createTaskInTeamState = (state: AppState, input: TaskInput, timestamp: string) => {
  requireProject(state, input.projectId);
  return createProjectTaskInState(state, input.projectId, input, timestamp, uid);
};

export const updateTaskInTeamState = (state: AppState, taskId: string, input: TaskUpdateInput, timestamp: string) => {
  requireTask(state, taskId);
  return updateTaskInState(state, taskId, (task) => ({
    ...task,
    title: input.title?.trim() || task.title,
    notes: input.notes === undefined ? task.notes : input.notes.trim(),
    tags: input.tags ?? task.tags,
    priority: input.priority ?? task.priority,
    severity: input.severity ?? task.severity,
    stage: input.stage ?? task.stage,
    estimatePomodoros: input.estimateHours === undefined
      ? Math.max(1, Math.round(input.estimatePomodoros ?? task.estimatePomodoros))
      : Math.max(1, Math.ceil((Math.max(0, input.estimateHours) * 60) / Math.max(1, state.settings.focusMinutes))),
    expectedStartAt: input.expectedStartAt === undefined ? task.expectedStartAt : input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt === undefined ? task.expectedFinishAt : input.expectedFinishAt,
    dueAt: input.dueAt === undefined ? task.dueAt : input.dueAt,
    reminderAt: input.reminderAt === undefined ? task.reminderAt : input.reminderAt,
    repeatRule: input.repeatRule ?? task.repeatRule,
    repeatIntervalDays: input.repeatIntervalDays === undefined ? task.repeatIntervalDays : input.repeatIntervalDays,
    subtasks: input.subtasks === undefined
      ? task.subtasks
      : input.subtasks
        .map((title) => title.trim())
        .filter(Boolean)
        .map((title) => ({ id: uid("subtask"), title, completed: false, createdAt: timestamp })),
  }), timestamp);
};

export const deleteTaskInTeamState = (state: AppState, taskId: string, timestamp: string) =>
  deleteTaskFromState(state, requireTask(state, taskId), timestamp).state;

export const assignTaskInTeamState = (state: AppState, taskId: string, assignment: TaskAssignmentInput, timestamp: string) =>
  assignTaskInState(state, taskId, assignment, timestamp);

export const setTaskStatusInTeamState = (state: AppState, taskId: string, status: TaskStatus, timestamp: string) =>
  updateTaskInState(state, taskId, (task) => ({
    ...task,
    status,
    completedAt: status === "completed" ? task.completedAt ?? timestamp : task.completedAt,
  }), timestamp);

export const updateTaskProgressInTeamState = (state: AppState, taskId: string, progressPercent: number, progressNote: string, timestamp: string) =>
  updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp);

export const splitTaskInTeamState = (state: AppState, taskId: string, childTitles: string[], timestamp: string) => {
  const task = requireTask(state, taskId);
  const titles = childTitles.map((title) => title.trim()).filter(Boolean);
  if (titles.length < 2) throw new Error("split_task requires at least two child titles.");
  return splitTaskInState(state, task, titles, timestamp, () => uid("task")).state;
};

export const addTaskToTodayInTeamState = (state: AppState, taskId: string, timestamp: string) =>
  addTaskToTodayInState(state, taskId, timestamp);

export const batchAddTasksToTodayInTeamState = (state: AppState, taskIds: string[], timestamp: string) =>
  taskIds.reduce((current, taskId) => addTaskToTodayInState(current, taskId, timestamp), state);

export const removeTaskFromTodayInTeamState = (state: AppState, taskId: string, timestamp: string) =>
  removeTaskFromTodayInState(state, taskId, timestamp);

export const moveTodayTaskInTeamState = (state: AppState, taskId: string, direction: -1 | 1, timestamp: string) =>
  moveCommittedTaskInState(state, taskId, direction, timestamp);

export const scheduleTaskForDateInState = (state: AppState, taskId: string, date: string, timestamp: string) => {
  const task = requireTask(state, taskId);
  if (date === today()) return addTaskToTodayInState(state, taskId, timestamp);
  const workspaceId = workspaceIdForTask(state, task) ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? {
    ...createDailyPlanForDate(state, date, timestamp, workspaceId),
    capacityPomodoros: state.rewardState.dailyGoal,
    recommendedCapacityPomodoros: state.rewardState.dailyGoal,
    suggestedCapacityPomodoros: state.rewardState.dailyGoal,
    overloadAcknowledged: false,
  };
  const nextPlan = {
    ...plan,
    committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
    updatedAt: timestamp,
  };
  return {
    ...state,
    tasks: state.tasks.map((item) => item.id === taskId && item.status === "pool" ? { ...item, status: "committed" as const, updatedAt: timestamp } : item),
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp,
  };
};

export const startTaskInTeamState = (state: AppState, taskId: string, timestamp: string) =>
  startWorkSessionInState(state, taskId, timestamp, { source: "mcp", idFactory: uid });

export const pauseWorkSessionInTeamState = (state: AppState, input: WorkSessionInput, timestamp: string) =>
  pauseWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp", idFactory: uid });

export const resumeWorkSessionInTeamState = (state: AppState, input: WorkSessionInput, timestamp: string) =>
  resumeWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp", idFactory: uid });

export const finishWorkSessionInTeamState = (state: AppState, input: WorkSessionInput, timestamp: string) =>
  finishWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { outcome: input.outcome, source: "mcp", idFactory: uid });
