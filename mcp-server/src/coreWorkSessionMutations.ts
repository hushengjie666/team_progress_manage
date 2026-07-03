import type { AppState } from "../../src/types.js";
import {
  finishWorkSessionInState as finishWorkSessionState,
  pauseWorkSessionInState as pauseWorkSessionState,
  resumeWorkSessionInState as resumeWorkSessionState,
  startWorkSessionInState,
} from "../../src/workSessionTransitions.js";
import { compactTask } from "./coreTaskModel.js";
import type { WorkSessionMutationInput } from "./coreTaskMutationTypes.js";

export const startTaskMutation = (state: AppState, taskId: string, timestamp: string) => {
  const next = startWorkSessionInState(state, taskId, timestamp, { source: "mcp" });
  const session = next.workSessions.find((item) => item.taskId === taskId && item.startedAt === timestamp);
  return { state: next, result: { task: compactTask(next, next.tasks.find((item) => item.id === taskId)!), workSession: session } };
};

export const pauseWorkSessionMutation = (state: AppState, timestamp: string, input: WorkSessionMutationInput) => ({
  state: pauseWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
  result: { paused: true },
});

export const resumeWorkSessionMutation = (state: AppState, timestamp: string, input: WorkSessionMutationInput) => ({
  state: resumeWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
  result: { resumed: true },
});

export const finishWorkSessionMutation = (state: AppState, timestamp: string, input: WorkSessionMutationInput) => ({
  state: finishWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
  result: { finished: true },
});
