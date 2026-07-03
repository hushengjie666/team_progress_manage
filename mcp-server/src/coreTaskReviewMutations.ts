import {
  acceptTaskInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
} from "../../src/teamProgress.js";
import type { AppState } from "../../src/types.js";
import { actorMemberIdForTask, compactTask } from "./coreTaskModel.js";

export const submitTaskReviewMutation = (state: AppState, taskId: string, timestamp: string) => {
  const next = submitTaskForReviewInState(state, taskId, actorMemberIdForTask(state, taskId), timestamp);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return { state: next, result: compactTask(next, task) };
};

export const acceptTaskReviewMutation = (state: AppState, taskId: string, timestamp: string) => {
  const next = acceptTaskInState(state, taskId, actorMemberIdForTask(state, taskId), timestamp);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return { state: next, result: compactTask(next, task) };
};

export const returnTaskReviewMutation = (state: AppState, taskId: string, reason: string, timestamp: string) => {
  const next = returnTaskForReviewInState(state, taskId, reason, actorMemberIdForTask(state, taskId), timestamp);
  const task = next.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return { state: next, result: compactTask(next, task) };
};
