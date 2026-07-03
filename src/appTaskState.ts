import { resolveMemberIdForProject } from "./memberIdentity";
import type { AppState, Task } from "./types";
import {
  emptyTaskDefaults,
  getTodayPlan,
  parseDateTimeLocal,
  type TaskDraft,
} from "./appModel";

export function createTaskFromDraft({
  state,
  draft,
  projectId,
  currentProjectId,
  timestamp,
  taskId,
  sortOrder,
}: {
  state: AppState;
  draft: TaskDraft;
  projectId?: string;
  currentProjectId: string;
  timestamp: string;
  taskId: string;
  sortOrder: number;
}): Task {
  const targetProject = projectId
    ? state.projects.find((project) => project.id === projectId) ?? state.projects[0]
    : state.projects[0];
  const taskProjectId = targetProject?.id ?? currentProjectId;
  return {
    id: taskId,
    workspaceId: targetProject?.workspaceId ?? state.auth.workspace?.id,
    title: draft.title.trim(),
    notes: draft.notes.trim(),
    tags: draft.tags
      .split(/[,\s，]+/)
      .map((item) => item.trim())
      .filter(Boolean),
    projectId: taskProjectId,
    project: projectId ? (targetProject?.name ?? draft.project.trim()) || "Inbox" : draft.project.trim() || "Inbox",
    creatorMemberId: resolveMemberIdForProject(state, taskProjectId),
    priority: draft.priority,
    severity: draft.severity,
    stage: draft.stage,
    estimatePomodoros: Math.max(0, Math.round(draft.estimatePomodoros)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, sortOrder),
    dueAt: parseDateTimeLocal(draft.dueAt),
    reminderAt: parseDateTimeLocal(draft.reminderAt),
    repeatRule: draft.repeatRule,
    repeatIntervalDays:
      draft.repeatRule === "interval" || draft.repeatRule === "after_completion"
        ? Math.max(1, Math.round(draft.repeatIntervalDays))
        : undefined,
  };
}

export function updateTaskInState(
  state: AppState,
  taskId: string,
  updater: Partial<Task> | ((task: Task) => Task),
  timestamp: string,
): AppState {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextTask = typeof updater === "function" ? updater(task) : { ...task, ...updater };
      return { ...nextTask, updatedAt: timestamp };
    }),
    updatedAt: timestamp,
  };
}

export function moveCommittedTaskInState(state: AppState, taskId: string, direction: -1 | 1, timestamp: string): AppState {
  const plan = getTodayPlan(state);
  const index = plan.committedTaskIds.indexOf(taskId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= plan.committedTaskIds.length) return state;
  const committedTaskIds = [...plan.committedTaskIds];
  [committedTaskIds[index], committedTaskIds[nextIndex]] = [committedTaskIds[nextIndex], committedTaskIds[index]];
  return {
    ...state,
    dailyPlans: state.dailyPlans.map((item) =>
      item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item,
    ),
    updatedAt: timestamp,
  };
}
