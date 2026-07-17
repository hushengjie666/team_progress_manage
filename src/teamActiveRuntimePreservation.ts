import type { AppState, ExecutionSignal, FocusSession, Task, WorkSession } from "./types";

const upsertById = <T extends { id: string }>(items: T[], incoming: T) =>
  items.some((item) => item.id === incoming.id)
    ? items.map((item) => (item.id === incoming.id ? incoming : item))
    : [incoming, ...items];

const localIsNewerOrMissing = <T extends { updatedAt?: string; startedAt?: string }>(local: T, remote?: T) =>
  !remote || (local.updatedAt ?? local.startedAt ?? "") >= (remote.updatedAt ?? remote.startedAt ?? "");

export const preserveLocalActiveRuntime = (remote: AppState, local: AppState): AppState => {
  const active = local.activeTimer;
  if (!active) return remote;

  let next = { ...remote, activeTimer: active };
  const localTask = active.taskId ? local.tasks.find((task) => task.id === active.taskId) : undefined;
  if (localTask && localIsNewerOrMissing<Task>(localTask, next.tasks.find((task) => task.id === localTask.id))) {
    next = { ...next, tasks: upsertById(next.tasks, localTask) };
  }

  const localFocusSession = local.focusSessions.find((session) => session.id === active.sessionId);
  if (
    localFocusSession &&
    localIsNewerOrMissing<FocusSession>(localFocusSession, next.focusSessions.find((session) => session.id === localFocusSession.id))
  ) {
    next = { ...next, focusSessions: upsertById(next.focusSessions, localFocusSession) };
  }

  const localWorkSession = local.workSessions.find((session) =>
    active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId,
  );
  if (
    localWorkSession &&
    (localWorkSession.status === "active" || localWorkSession.status === "paused") &&
    localIsNewerOrMissing<WorkSession>(localWorkSession, next.workSessions.find((session) => session.id === localWorkSession.id))
  ) {
    next = { ...next, workSessions: upsertById(next.workSessions, localWorkSession) };
  }

  const localSignals = localWorkSession
    ? local.executionSignals.filter((signal) => signal.workSessionId === localWorkSession.id)
    : [];
  if (localSignals.length) {
    const existingSignalIds = new Set(next.executionSignals.map((signal) => signal.id));
    const missingSignals = localSignals.filter((signal) => !existingSignalIds.has(signal.id));
    if (missingSignals.length) {
      next = { ...next, executionSignals: [...missingSignals, ...next.executionSignals] as ExecutionSignal[] };
    }
  }

  return next;
};
