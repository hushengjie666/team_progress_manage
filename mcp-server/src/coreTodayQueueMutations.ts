import { todayKey } from "../../src/seed.js";
import type { AppState } from "../../src/types.js";
import {
  addTaskToTodayInState as addToTodayInState,
  removeTaskFromTodayQueueInState as removeFromTodayInState,
} from "../../src/workSessionTransitions.js";

const todayQueueResult = (next: AppState, taskId?: string) => ({
  taskId,
  date: todayKey(),
  committedTaskIds: next.dailyPlans.find((plan) => plan.date === todayKey())?.committedTaskIds ?? [],
});

export const batchAddTasksToTodayMutation = (state: AppState, taskIds: string[], timestamp: string) => {
  let next = state;
  for (const taskId of taskIds) {
    next = addToTodayInState(next, taskId, timestamp);
  }
  return { state: next, result: todayQueueResult(next) };
};

export const addTaskToTodayMutation = (state: AppState, taskId: string, timestamp: string) => {
  const next = addToTodayInState(state, taskId, timestamp);
  return { state: next, result: todayQueueResult(next, taskId) };
};

export const removeTaskFromTodayMutation = (state: AppState, taskId: string, timestamp: string) => {
  const next = removeFromTodayInState(state, taskId, timestamp);
  return { state: next, result: todayQueueResult(next, taskId) };
};
