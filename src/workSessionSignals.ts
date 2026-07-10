import { uid } from "./seed";
import type { ExecutionSignal, ExecutionSignalType, WorkSession } from "./types";

export type IdFactory = (prefix: string) => string;

export type ExecutionSignalSource = "app" | "cli";

export const createExecutionSignal = (
  workSession: WorkSession,
  type: ExecutionSignalType,
  timestamp: string,
  payload?: Record<string, unknown>,
  idFactory: IdFactory = uid,
): ExecutionSignal => ({
  id: idFactory("signal"),
  workspaceId: workSession.workspaceId,
  workSessionId: workSession.id,
  taskId: workSession.taskId,
  executorMemberId: workSession.executorMemberId,
  type,
  createdAt: timestamp,
  payload,
});

export const sortedByUpdatedAt = <T extends { updatedAt: string }>(items: T[]) =>
  [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
