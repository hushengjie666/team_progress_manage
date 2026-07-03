import { resolveCurrentMember } from "./memberIdentity";
import { filterTodayCommittedTasksForMember } from "./projectOverview";
import type { AppState, DailyPlan, ProjectMember, Task } from "./types";

export const committedTasksForPlan = (state: AppState, todayPlan: DailyPlan): Task[] =>
  todayPlan.committedTaskIds
    .map((id) => state.tasks.find((task) => task.id === id))
    .filter((task): task is Task => task !== undefined && task.status !== "split" && task.status !== "archived");

export const currentMemberForState = (state: AppState): ProjectMember | undefined => resolveCurrentMember(state);

export const focusTasksForMember = (state: AppState, committedTasks: Task[], currentMember?: ProjectMember): Task[] =>
  filterTodayCommittedTasksForMember(state, committedTasks, currentMember, { includeUnassigned: true });

const focusTaskRank = (task: Task) => {
  if (task.status === "in_progress") return 0;
  if (task.status === "pending_review") return 1;
  if (task.status === "committed") return 2;
  return 3;
};

const canShowAsFocusTask = (task: Task) => focusTaskRank(task) < 3;

export const currentTaskForFocus = (state: AppState, focusCommittedTasks: Task[], preferredTaskId?: string | null): Task | undefined => {
  if (!state.activeTimer?.taskId) {
    const preferredTask = preferredTaskId
      ? focusCommittedTasks.find((task) => task.id === preferredTaskId && canShowAsFocusTask(task))
      : undefined;
    if (preferredTask) return preferredTask;
    return [...focusCommittedTasks]
      .filter(canShowAsFocusTask)
      .sort((left, right) => focusTaskRank(left) - focusTaskRank(right) || left.sortOrder - right.sortOrder)[0];
  }
  return state.tasks.find((task) => task.id === state.activeTimer?.taskId && canShowAsFocusTask(task));
};

export const taskById = (state: AppState, taskId?: string | null): Task | undefined => {
  if (!taskId) return undefined;
  return state.tasks.find((task) => task.id === taskId);
};
