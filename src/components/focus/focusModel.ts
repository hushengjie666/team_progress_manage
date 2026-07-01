import { completedFocusSessions } from "../../domain";
import type { ActiveTimer, AppState, SessionMode, Task } from "../../types";

export type FocusTaskGroup = {
  projectId: string;
  project: string;
  tasks: Task[];
};

export const focusProgressPercent = (active?: ActiveTimer) =>
  active ? 100 - (active.remaining / active.duration) * 100 : 0;

export const displayRemainingForTimer = (active: ActiveTimer, now = new Date()) => {
  if (!active.isRunning || active.pendingSettlement === "pending") return Math.max(0, active.remaining);
  const remaining = Math.ceil((new Date(active.plannedEndAt).getTime() - now.getTime()) / 1000);
  return Math.max(0, Math.min(active.duration, remaining));
};

export const upcomingBreakMode = (state: AppState): SessionMode =>
  completedFocusSessions(state).length > 0 && completedFocusSessions(state).length % state.settings.longBreakEvery === 0
    ? "long_break"
    : "short_break";

const isVisibleFocusTask = (task: Task) =>
  task.status === "committed" || task.status === "in_progress" || task.status === "pending_review" || task.status === "completed";

const focusTaskStatusRank = (task: Task) => {
  if (task.status === "in_progress") return 0;
  if (task.status === "committed") return 1;
  if (task.status === "pending_review") return 2;
  return 3;
};

export const buildFocusTaskList = (currentTask: Task | undefined, committedTasks: Task[], _activeTaskId?: string) =>
  [
    ...(currentTask && !committedTasks.some((task) => task.id === currentTask.id) ? [currentTask] : []),
    ...committedTasks,
  ]
    .filter(isVisibleFocusTask)
    .sort((left, right) => focusTaskStatusRank(left) - focusTaskStatusRank(right) || left.sortOrder - right.sortOrder);

export const groupFocusTasksByProject = (tasks: Task[]) =>
  tasks.reduce<FocusTaskGroup[]>((groups, task) => {
    const projectId = task.projectId || task.project || "unassigned_project";
    const project = task.project || "未分项目";
    const group = groups.find((item) => item.projectId === projectId);
    if (group) {
      group.tasks.push(task);
    } else {
      groups.push({ projectId, project, tasks: [task] });
    }
    return groups;
  }, []);
