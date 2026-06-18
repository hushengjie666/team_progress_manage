import { emptyTaskDefaults, nowIso, priorityWeight } from "./appModel";
import { uid } from "./seed";
import type { AppState, Priority, ProjectMember, RepeatRule, Severity, Task, TaskStage, TaskStatus } from "./types";

type IdFactory = (prefix: string) => string;

export type ProjectAccess = {
  canView: boolean;
  canEditTasks: boolean;
  canReviewTasks: boolean;
  memberName?: string;
};

export type ProjectTaskInput = {
  title: string;
  notes?: string;
  tags?: string[];
  priority?: Priority;
  severity?: Severity;
  stage?: TaskStage;
  estimateHours?: number;
  estimatePomodoros?: number;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
  expectedStartAt?: string;
  expectedFinishAt?: string;
  dueAt?: string;
  reminderAt?: string;
  repeatRule?: RepeatRule;
  repeatIntervalDays?: number;
  subtasks?: string[];
};

const estimateHoursToPomodoros = (estimateHours?: number, focusMinutes = 25) => {
  const safeFocusMinutes = Math.max(1, Math.round(focusMinutes));
  const safeHours = Math.max(0, estimateHours ?? 1);
  return Math.max(1, Math.ceil((safeHours * 60) / safeFocusMinutes));
};

export type ProjectOverviewTaskGroup = {
  memberId?: string;
  memberName: string;
  tasks: Task[];
  hasActiveTask: boolean;
};

export type ProjectOverviewTaskBoard = {
  poolTasks: Task[];
  pendingReviewTasks: Task[];
  inProgressTasks: Task[];
  todayWorkGroups: ProjectOverviewTaskGroup[];
};

export const projectTasksForProject = (state: AppState, projectId: string) =>
  state.tasks
    .filter((task) => task.projectId === projectId)
    .sort((left, right) => {
      const statusOrder: Record<TaskStatus, number> = {
        in_progress: 0,
        pending_review: 1,
        committed: 2,
        pool: 3,
        completed: 4,
        split: 5,
        archived: 6,
      };
      const statusDelta = statusOrder[left.status] - statusOrder[right.status];
      if (statusDelta !== 0) return statusDelta;
      return left.sortOrder - right.sortOrder;
    });

export const filterProjectTasks = (
  tasks: Task[],
  filters: {
    query: string;
    status: "all" | TaskStatus;
    executor: "all" | "unassigned" | string;
    priority: "all" | Priority;
    sort: "status" | "priority" | "dueAt" | "updatedAt";
  },
) => {
  const query = filters.query.trim().toLowerCase();
  const filtered = tasks.filter((task) => {
    const matchesQuery =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      task.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesStatus = filters.status === "all" ? task.status !== "split" : task.status === filters.status;
    const matchesExecutor =
      filters.executor === "all" ||
      (filters.executor === "unassigned" ? !task.primaryExecutorMemberId : task.primaryExecutorMemberId === filters.executor);
    const matchesPriority = filters.priority === "all" || task.priority === filters.priority;
    return matchesQuery && matchesStatus && matchesExecutor && matchesPriority;
  });

  return [...filtered].sort((left, right) => {
    if (filters.sort === "priority") return priorityWeight[right.priority] - priorityWeight[left.priority];
    if (filters.sort === "dueAt") return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
    if (filters.sort === "updatedAt") return right.updatedAt.localeCompare(left.updatedAt);
    return left.sortOrder - right.sortOrder;
  });
};

export const buildProjectOverviewTaskBoard = (
  tasks: Task[],
  members: ProjectMember[],
  activeTaskIds?: string | Iterable<string>,
  todayTaskIds: Iterable<string> = [],
): ProjectOverviewTaskBoard => {
  const visibleTasks = tasks.filter((task) => task.status !== "split" && task.status !== "archived");
  const poolTasks = visibleTasks.filter((task) => task.status === "pool" || task.status === "committed");
  const pendingReviewTasks = visibleTasks.filter((task) => task.status === "pending_review");
  const inProgressTasks = visibleTasks.filter((task) => task.status === "in_progress");
  const activeTaskIdSet = typeof activeTaskIds === "string" ? new Set([activeTaskIds]) : new Set(activeTaskIds ?? []);
  const todayTaskIdSet = new Set(todayTaskIds);
  const todayWorkTasks = visibleTasks.filter((task) => todayTaskIdSet.has(task.id));
  const membersById = new Map(members.map((member) => [member.id, member]));
  const memberOrder = new Map(members.map((member, index) => [member.id, index]));
  const groupsByKey = new Map<string, ProjectOverviewTaskGroup>();

  members.forEach((member) => {
    groupsByKey.set(member.id, {
      memberId: member.id,
      memberName: member.name,
      tasks: [],
      hasActiveTask: false,
    });
  });

  todayWorkTasks.forEach((task) => {
    const member = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId) : undefined;
    const key = member?.id ?? "__unassigned";
    const existing = groupsByKey.get(key);
    const group =
      existing ??
      {
        memberId: member?.id,
        memberName: member?.name ?? "未分配",
        tasks: [],
        hasActiveTask: false,
    };
    group.tasks.push(task);
    group.hasActiveTask = group.hasActiveTask || activeTaskIdSet.has(task.id);
    groupsByKey.set(key, group);
  });

  const statusOrder: Record<TaskStatus, number> = {
    in_progress: 0,
    committed: 1,
    pending_review: 2,
    pool: 3,
    completed: 4,
    split: 5,
    archived: 6,
  };
  const todayWorkGroups = [...groupsByKey.values()].map((group) => ({
    ...group,
    tasks: [...group.tasks].sort((left, right) => {
      if (activeTaskIdSet.has(left.id) && !activeTaskIdSet.has(right.id)) return -1;
      if (activeTaskIdSet.has(right.id) && !activeTaskIdSet.has(left.id)) return 1;
      const statusDelta = statusOrder[left.status] - statusOrder[right.status];
      if (statusDelta !== 0) return statusDelta;
      return left.sortOrder - right.sortOrder;
    }),
  })).sort((left, right) => {
    if (left.hasActiveTask !== right.hasActiveTask) return left.hasActiveTask ? -1 : 1;
    if (left.tasks.length !== right.tasks.length) return right.tasks.length - left.tasks.length;
    const leftOrder = left.memberId ? memberOrder.get(left.memberId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    const rightOrder = right.memberId ? memberOrder.get(right.memberId) ?? Number.MAX_SAFE_INTEGER : Number.MAX_SAFE_INTEGER;
    return leftOrder - rightOrder;
  });

  return { poolTasks, pendingReviewTasks, inProgressTasks, todayWorkGroups };
};

export const projectAccessForCurrentMember = (state: AppState, projectId: string): ProjectAccess => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return { canView: false, canEditTasks: false, canReviewTasks: false };

  const currentMember = state.currentMemberId ? state.projectMembers.find((item) => item.id === state.currentMemberId) : undefined;
  const accountId = state.auth.account?.id ?? currentMember?.accountId;
  const teamMemberId = currentMember?.teamMemberId;
  const email = (state.auth.account?.email ?? currentMember?.email)?.toLowerCase();
  const member = state.projectMembers.find((item) => {
    if (item.projectId !== projectId || item.status === "disabled") return false;
    if (item.id === state.currentMemberId) return true;
    if (accountId && item.accountId === accountId) return true;
    if (teamMemberId && item.teamMemberId === teamMemberId) return true;
    if (email && item.email?.toLowerCase() === email) return true;
    return false;
  });
  return {
    canView: true,
    canEditTasks: true,
    canReviewTasks: true,
    memberName: member?.name,
  };
};

export const createProjectTaskInState = (
  state: AppState,
  projectId: string,
  input: ProjectTaskInput,
  timestamp = nowIso(),
  idFactory: IdFactory = uid,
): AppState => {
  const title = input.title.trim();
  const project = state.projects.find((item) => item.id === projectId);
  if (!title || !project) return state;

  const task: Task = {
    id: idFactory("task"),
    title,
    notes: input.notes?.trim() ?? "",
    tags: input.tags ?? [],
    projectId: project.id,
    project: project.name,
    creatorMemberId: state.currentMemberId,
    primaryExecutorMemberId: input.primaryExecutorMemberId || undefined,
    collaboratorMemberIds: input.collaboratorMemberIds?.filter((id) => id !== input.primaryExecutorMemberId) ?? [],
    expectedStartAt: input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt,
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    stage: input.stage ?? "requirements",
    estimatePomodoros: input.estimateHours !== undefined
      ? estimateHoursToPomodoros(input.estimateHours, state.settings.focusMinutes)
      : Math.max(1, Math.round(input.estimatePomodoros ?? 1)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, Date.now()),
    dueAt: input.dueAt,
    reminderAt: input.reminderAt,
    repeatRule: input.repeatRule ?? "none",
    repeatIntervalDays: input.repeatIntervalDays,
    subtasks: (input.subtasks ?? [])
      .map((title) => title.trim())
      .filter(Boolean)
      .map((title) => ({
        id: idFactory("subtask"),
        title,
        completed: false,
        createdAt: timestamp,
      })),
  };

  return {
    ...state,
    tasks: [task, ...state.tasks],
    updatedAt: timestamp,
  };
};
