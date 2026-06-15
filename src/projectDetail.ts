import { emptyTaskDefaults, nowIso, priorityWeight } from "./appModel";
import { uid } from "./seed";
import type { AppState, Priority, Severity, Task, TaskStatus } from "./types";

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
  estimatePomodoros?: number;
  primaryExecutorMemberId?: string;
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
        archived: 5,
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
    const matchesStatus = filters.status === "all" || task.status === filters.status;
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

export const projectAccessForCurrentMember = (state: AppState, projectId: string): ProjectAccess => {
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
  if (!member) return { canView: false, canEditTasks: false, canReviewTasks: false };
  return {
    canView: true,
    canEditTasks: true,
    canReviewTasks: member.roles.includes("project_owner"),
    memberName: member.name,
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
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    estimatePomodoros: Math.max(0, Math.round(input.estimatePomodoros ?? 1)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, Date.now()),
  };

  return {
    ...state,
    tasks: [task, ...state.tasks],
    updatedAt: timestamp,
  };
};
