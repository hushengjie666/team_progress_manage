import { sortedByUpdatedAt } from "./workSessionSignals";
import type { AppState } from "./types";

export const latestActiveOrPausedWorkSession = (state: AppState, taskId?: string, workSessionId?: string) =>
  sortedByUpdatedAt(state.workSessions)
    .filter((session) => session.status === "active" || session.status === "paused")
    .find((session) => (workSessionId ? session.id === workSessionId : true) && (taskId ? session.taskId === taskId : true));

export const activeWorkSessionForExecutor = (state: AppState, executorMemberId?: string) =>
  state.workSessions.find((session) => (session.status === "active" || session.status === "paused") && session.executorMemberId === executorMemberId);
