import { createExecutionSignal, type ExecutionSignalSource, type IdFactory } from "./workSessionSignals";
import { latestActiveOrPausedWorkSession } from "./workSessionQueries";
import type { AppState, SessionOutcome, Task, WorkSession } from "./types";

export const finishWorkSessionInState = (
  state: AppState,
  timestamp: string,
  taskId?: string,
  workSessionId?: string,
  options: { outcome?: SessionOutcome; source?: ExecutionSignalSource; idFactory?: IdFactory } = {},
) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  const outcome = options.outcome ?? "completed";
  const nextSession: WorkSession = { ...session, status: "ended", pausedAt: undefined, endedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => (item.id === session.id ? nextSession : item)),
    focusSessions: state.focusSessions.map((item) =>
      item.id === session.focusSessionId ? { ...item, endedAt: timestamp, outcome } : item,
    ),
    tasks: state.tasks.map((task: Task) =>
      task.id === session.taskId
        ? {
            ...task,
            status: task.status === "pending_review" ? task.status : ("in_progress" as const),
            actualPomodoros: outcome === "completed" ? (task.actualPomodoros ?? 0) + 1 : task.actualPomodoros,
            updatedAt: timestamp,
          }
        : task,
    ),
    executionSignals: [
      createExecutionSignal(
        nextSession,
        "work_ended",
        timestamp,
        { outcome, ...(options.source ? { source: options.source } : {}) },
        options.idFactory,
      ),
      ...state.executionSignals,
    ],
    updatedAt: timestamp,
  };
};
