import { resolveMemberIdForProject } from "./memberIdentity";
import { uid } from "./seed";
import { createExecutionSignal, type ExecutionSignalSource, type IdFactory } from "./workSessionSignals";
import { addTaskToTodayInState } from "./workSessionTodayPlan";
import type { AppState, FocusSession, WorkSession } from "./types";

export const startWorkSessionInState = (
  state: AppState,
  taskId: string,
  timestamp: string,
  options: { source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status === "pending_review" || task.status === "completed" || task.status === "archived" || task.status === "split") {
    throw new Error(`Task ${taskId} cannot be started from status ${task.status}.`);
  }

  const next = addTaskToTodayInState(state, taskId, timestamp);
  const currentTask = next.tasks.find((item) => item.id === taskId)!;
  const executorMemberId = currentTask.primaryExecutorMemberId ?? resolveMemberIdForProject(next, currentTask.projectId);
  const activeForExecutor = executorMemberId
    ? next.workSessions.find((session) => session.status === "active" && session.executorMemberId === executorMemberId)
    : undefined;

  if (activeForExecutor?.taskId === taskId) return next;

  const endedSession: WorkSession | undefined = activeForExecutor
    ? {
        ...activeForExecutor,
        status: "ended",
        pausedAt: undefined,
        endedAt: timestamp,
        updatedAt: timestamp,
      }
    : undefined;

  const idFactory = options.idFactory ?? uid;
  const workspaceId = currentTask.workspaceId ?? state.projects.find((project) => project.id === currentTask.projectId)?.workspaceId ?? next.auth.workspace?.id;
  const focusSession: FocusSession = {
    id: idFactory("session"),
    workspaceId,
    taskId,
    mode: "focus",
    duration: next.settings.focusMinutes * 60,
    startedAt: timestamp,
    interruptionCounts: { internal: 0, external: 0 },
  };
  const workSession: WorkSession = {
    id: idFactory("work_session"),
    workspaceId,
    taskId,
    executorMemberId,
    focusSessionId: focusSession.id,
    status: "active",
    startedAt: timestamp,
    totalPausedSeconds: 0,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const signals = [
    createExecutionSignal(workSession, "work_started", timestamp, options.source ? { source: options.source } : undefined, idFactory),
    ...(endedSession
      ? [createExecutionSignal(endedSession, "work_ended", timestamp, { outcome: "skipped", reason: "task_switch" }, idFactory)]
      : []),
  ];

  return {
    ...next,
    focusSessions: [focusSession, ...next.focusSessions],
    workSessions: [
      workSession,
      ...next.workSessions.map((session) => (endedSession && session.id === endedSession.id ? endedSession : session)),
    ],
    executionSignals: [...signals, ...next.executionSignals],
    tasks: next.tasks.map((item) => (item.id === taskId ? { ...item, status: "in_progress" as const, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
};
