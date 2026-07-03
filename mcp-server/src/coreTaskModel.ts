import { resolveMemberIdForProject } from "../../src/memberIdentity.js";
import type { AppState, Task } from "../../src/types.js";
import { sortedByUpdatedAt } from "../../src/workSessionTransitions.js";
import type { TaskListFilter } from "./coreTypes.js";

export const compactTask = (state: AppState, task: Task) => {
  const executor = task.primaryExecutorMemberId
    ? state.projectMembers.find((member) => member.id === task.primaryExecutorMemberId)
    : undefined;
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    project: task.project,
    status: task.status,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    primaryExecutorName: executor?.name,
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    progressPercent: task.progressPercent ?? 0,
    estimatePomodoros: task.estimatePomodoros,
    actualPomodoros: task.actualPomodoros,
    dueAt: task.dueAt,
    updatedAt: task.updatedAt,
  };
};

export const actorMemberIdForTask = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ? resolveMemberIdForProject(state, task.projectId) : undefined;
};

export const taskMatchesFilter = (task: Task, filter: TaskListFilter) => {
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if ((filter.status ?? "all") !== "all" && task.status !== filter.status) return false;
  if (!filter.includeArchived && task.status === "archived") return false;
  if (!filter.includeSplit && task.status === "split") return false;
  if (filter.assigneeMemberId && task.primaryExecutorMemberId !== filter.assigneeMemberId) return false;
  const query = filter.query?.trim().toLowerCase();
  if (query) {
    const searchable = `${task.title} ${task.notes} ${task.tags.join(" ")} ${task.project}`.toLowerCase();
    if (!searchable.includes(query)) return false;
  }
  return true;
};

export const removeTaskReferences = (state: AppState, taskId: string, timestamp: string) => {
  const relatedWorkSessions = state.workSessions.filter((session) => session.taskId === taskId);
  const relatedWorkSessionIds = new Set(relatedWorkSessions.map((session) => session.id));
  const relatedFocusSessions = state.focusSessions.filter((session) => session.taskId === taskId);
  const relatedSignals = state.executionSignals.filter((signal) => signal.taskId === taskId || relatedWorkSessionIds.has(signal.workSessionId));
  return {
    ...state,
    tasks: state.tasks.filter((task) => task.id !== taskId),
    workSessions: state.workSessions.filter((session) => session.taskId !== taskId),
    focusSessions: state.focusSessions.filter((session) => session.taskId !== taskId),
    executionSignals: state.executionSignals.filter((signal) => signal.taskId !== taskId && !relatedWorkSessionIds.has(signal.workSessionId)),
    dailyPlans: state.dailyPlans.map((plan) => ({
      ...plan,
      committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId),
      suggestedTaskIds: plan.suggestedTaskIds.filter((id) => id !== taskId),
      updatedAt:
        plan.committedTaskIds.includes(taskId) || plan.suggestedTaskIds.includes(taskId)
          ? timestamp
          : plan.updatedAt,
    })),
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []),
        { entity: "task", id: taskId, deletedAt: timestamp },
        ...relatedWorkSessions.map((session) => ({ entity: "work_session" as const, id: session.id, deletedAt: timestamp })),
        ...relatedFocusSessions.map((session) => ({ entity: "focus_session" as const, id: session.id, deletedAt: timestamp })),
        ...relatedSignals.map((signal) => ({ entity: "execution_signal" as const, id: signal.id, deletedAt: timestamp })),
      ],
    },
    updatedAt: timestamp,
  };
};

export const activeWorkSessionsForTasks = (state: AppState, tasks: Task[]) => {
  const taskIds = new Set(tasks.map((task) => task.id));
  return sortedByUpdatedAt(state.workSessions).filter(
    (session) => taskIds.has(session.taskId) && (session.status === "active" || session.status === "paused"),
  );
};
