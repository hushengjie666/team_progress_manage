import { createProjectTaskInState } from "../../src/projectDetail.js";
import { uid } from "../../src/seed.js";
import type { AppState } from "../../src/types.js";
import { compactTask, removeTaskReferences } from "./coreTaskModel.js";
import type { UpdateTaskInput } from "./coreTypes.js";

export const updateTaskMutation = (state: AppState, taskId: string, input: UpdateTaskInput, timestamp: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const subtasks = input.subtasks
    ? input.subtasks.map((title) => title.trim()).filter(Boolean).map((title) => ({ id: uid("subtask"), title, completed: false, createdAt: timestamp }))
    : task.subtasks;
  const estimatePomodoros =
    input.estimateHours !== undefined
      ? Math.max(1, Math.ceil((Math.max(0, input.estimateHours) * 60) / Math.max(1, state.settings.focusMinutes)))
      : input.estimatePomodoros !== undefined
        ? Math.max(1, Math.round(input.estimatePomodoros))
        : task.estimatePomodoros;
  const next = {
    ...state,
    tasks: state.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            title: input.title?.trim() || item.title,
            notes: input.notes ?? item.notes,
            tags: input.tags ?? item.tags,
            priority: input.priority ?? item.priority,
            severity: input.severity ?? item.severity,
            stage: input.stage ?? item.stage,
            estimatePomodoros,
            expectedStartAt: input.expectedStartAt ?? item.expectedStartAt,
            expectedFinishAt: input.expectedFinishAt ?? item.expectedFinishAt,
            dueAt: input.dueAt ?? item.dueAt,
            reminderAt: input.reminderAt ?? item.reminderAt,
            repeatRule: input.repeatRule ?? item.repeatRule,
            repeatIntervalDays: input.repeatIntervalDays ?? item.repeatIntervalDays,
            subtasks,
            updatedAt: timestamp,
          }
        : item,
    ),
    updatedAt: timestamp,
  };
  const updated = next.tasks.find((item) => item.id === taskId)!;
  return { state: next, result: compactTask(next, updated) };
};

export const splitTaskMutation = (state: AppState, taskId: string, childTitles: string[], timestamp: string) => {
  const parent = state.tasks.find((task) => task.id === taskId);
  if (!parent) throw new Error(`Task not found: ${taskId}`);
  const titles = childTitles.map((title) => title.trim()).filter(Boolean);
  if (!titles.length) throw new Error("At least one child task title is required.");
  let next: AppState = {
    ...state,
    tasks: state.tasks.map((task) =>
      task.id === taskId
        ? {
            ...task,
            status: "split" as const,
            progressNote: task.progressNote || "任务已拆分为更小工作项。",
            updatedAt: timestamp,
          }
        : task,
    ),
    dailyPlans: state.dailyPlans.map((plan) =>
      plan.committedTaskIds.includes(taskId)
        ? { ...plan, committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId), updatedAt: timestamp }
        : plan,
    ),
    updatedAt: timestamp,
  };
  const childIds: string[] = [];
  for (const title of titles) {
    const beforeIds = new Set(next.tasks.map((task) => task.id));
    next = createProjectTaskInState(next, parent.projectId, {
      title,
      notes: `由「${parent.title}」拆分而来。`,
      tags: parent.tags,
      priority: parent.priority,
      severity: parent.severity,
      stage: parent.stage,
      estimatePomodoros: Math.max(1, Math.ceil(parent.estimatePomodoros / titles.length)),
      primaryExecutorMemberId: parent.primaryExecutorMemberId,
      collaboratorMemberIds: parent.collaboratorMemberIds,
      dueAt: parent.dueAt,
    }, timestamp);
    const created = next.tasks.find((task) => !beforeIds.has(task.id));
    if (created) childIds.push(created.id);
  }
  return {
    state: next,
    result: {
      parent: compactTask(next, next.tasks.find((task) => task.id === taskId)!),
      children: childIds.map((id) => compactTask(next, next.tasks.find((task) => task.id === id)!)),
    },
  };
};

export const deleteTaskMutation = (state: AppState, taskId: string, timestamp: string) => {
  if (!state.tasks.some((task) => task.id === taskId)) throw new Error(`Task not found: ${taskId}`);
  return { state: removeTaskReferences(state, taskId, timestamp), result: { deletedTaskId: taskId } };
};
