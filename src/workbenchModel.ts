import { priorityWeight, type TaskFilters } from "./appModel";
import { coachSteps, planPressure, taskSuggestions, unresolvedInterruptions } from "./domain";
import {
  projectMemberIdentityIds,
  resolveCurrentMember,
  taskAssignedToMemberIdentity,
} from "./memberIdentity";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  filterTodayCompletedTasksForMember,
  filterTodayCommittedTasksForMember,
} from "./projectOverview";
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

export const poolTasksForFilters = (state: AppState, todayPlan: DailyPlan, taskFilters: TaskFilters): Task[] => {
  const query = taskFilters.query.trim().toLowerCase();
  const filtered = state.tasks.filter((task) => {
    const matchesQuery =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      task.project.toLowerCase().includes(query) ||
      task.tags.some((tag) => tag.toLowerCase().includes(query));

    return (
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived" &&
      !todayPlan.committedTaskIds.includes(task.id) &&
      matchesQuery &&
      (taskFilters.project === "all" || task.project === taskFilters.project) &&
      (taskFilters.tag === "all" || task.tags.includes(taskFilters.tag)) &&
      (taskFilters.priority === "all" || task.priority === taskFilters.priority)
    );
  });

  return [...filtered].sort((left, right) => {
    if (taskFilters.sort === "dueAt") return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
    if (taskFilters.sort === "priority") return priorityWeight[right.priority] - priorityWeight[left.priority];
    if (taskFilters.sort === "estimate") return right.estimatePomodoros - left.estimatePomodoros;
    return left.sortOrder - right.sortOrder;
  });
};

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

export const deriveWorkspaceModel = (
  state: AppState,
  todayPlan: DailyPlan,
  totalCommittedEstimate: number,
  committedTasks: Task[],
  poolTasks: Task[],
  selectedWorkbenchProjectIds: string[],
) => {
  const remainingEstimate = Math.max(0, totalCommittedEstimate - todayPlan.completedPomodoros);
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  const inbox = unresolvedInterruptions(state).slice(0, 6);
  const pressure = planPressure(state, todayPlan);
  const suggestions = taskSuggestions(state, todayPlan.date, 5);
  const suggestionItems = suggestions
    .map((suggestion) => {
      const task = state.tasks.find((item) => item.id === suggestion.taskId);
      return task ? { suggestion, task } : undefined;
    })
    .filter((item): item is { suggestion: typeof suggestions[number]; task: Task } => Boolean(item));
  const guideSteps = coachSteps(state, todayPlan.date).filter((step) => !(state.settings.dismissedCoachSteps ?? []).includes(step.id));
  const nextGuideStep = guideSteps.find((step) => !step.completed);
  const currentMember = currentMemberForState(state);
  const myProjectTaskCards = buildMyProjectTaskCards(state, currentMember);
  const todayCommittedTasks = filterTodayCommittedTasksForMember(state, committedTasks, currentMember, { includeUnassigned: true });
  const todayCompletedTasks = filterTodayCompletedTasksForMember(state, todayPlan.date, currentMember, { includeUnassigned: true });
  const todayWorkbenchTasks = [
    ...todayCommittedTasks,
    ...todayCompletedTasks.filter((task) => !todayCommittedTasks.some((item) => item.id === task.id)),
  ];
  const todayWorkbenchTaskIds = new Set(todayWorkbenchTasks.map((task) => task.id));
  const availableWorkbenchProjectIds = Array.from(new Set([
    ...myProjectTaskCards.map((card) => card.projectId),
    ...todayWorkbenchTasks.map((task) => task.projectId),
  ]));
  const effectiveWorkbenchProjectIds = selectedWorkbenchProjectIds.length > 0
    ? selectedWorkbenchProjectIds
    : availableWorkbenchProjectIds;
  const selectedProjectIdSet = new Set(effectiveWorkbenchProjectIds);
  const memberIdentityIds = projectMemberIdentityIds(state, currentMember);
  const isVisibleWorkbenchTask = (task: Task) =>
    selectedProjectIdSet.has(task.projectId) &&
    task.status !== "split" &&
    task.status !== "archived" &&
    (taskAssignedToMemberIdentity(task, memberIdentityIds) || todayWorkbenchTaskIds.has(task.id));
  const isVisiblePoolWorkbenchTask = (task: Task) =>
    selectedProjectIdSet.has(task.projectId) &&
    task.status !== "completed" &&
    task.status !== "split" &&
    task.status !== "archived" &&
    taskAssignedToMemberIdentity(task, memberIdentityIds, { includeUnassigned: true });
  const committedWorkbenchTasks = todayWorkbenchTasks.filter(isVisibleWorkbenchTask);
  const poolWorkbenchTasks = poolTasks.filter(isVisiblePoolWorkbenchTask);
  const projectOverviewCards = buildProjectOverviewCards(state);

  return {
    remainingEstimate,
    projects,
    tags,
    inbox,
    pressure,
    suggestions,
    suggestionItems,
    guideSteps,
    nextGuideStep,
    currentMember,
    myProjectTaskCards,
    availableWorkbenchProjectIds,
    effectiveWorkbenchProjectIds,
    committedWorkbenchTasks,
    poolWorkbenchTasks,
    projectOverviewCards,
  };
};

export type WorkspaceViewModel = ReturnType<typeof deriveWorkspaceModel>;
