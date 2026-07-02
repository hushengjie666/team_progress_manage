import { defaultTaskStageForMode, emptyTaskDefaults, nowIso, priorityWeight } from "./appModel";
import {
  accessibleProjectIdsForCurrentUser,
  buildAccessibleProjectMembers,
  canReviewProjectTasks,
  resolveProjectMemberForAccount,
  type ProjectAccessibleMember,
} from "./accessControl";
import { resolveMemberForProject, resolveMemberIdForProject } from "./memberIdentity";
import { buildProgressBoard } from "./progressBoard";
import { uid } from "./seed";
import type {
  AppState,
  Priority,
  ProjectMember,
  ProjectMemberRole,
  RepeatRule,
  Severity,
  Task,
  TaskStage,
  TaskStatus,
} from "./types";

type IdFactory = (prefix: string) => string;

const projectTaskStatuses: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];

export type { ProjectAccessibleMember };
export { buildAccessibleProjectMembers };

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

export type ProjectTaskFilters = {
  query: string;
  status: "all" | TaskStatus;
  executor: "all" | "unassigned" | string;
  priority: "all" | Priority;
  sort: "status" | "priority" | "dueAt" | "updatedAt";
};

export const initialProjectTaskFilters: ProjectTaskFilters = {
  query: "",
  status: "all",
  executor: "all",
  priority: "all",
  sort: "status",
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
  filters: ProjectTaskFilters,
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

export const deriveProjectDetailModel = (state: AppState, projectId: string, filters: ProjectTaskFilters, date = nowIso().slice(0, 10)) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return undefined;

  const access = projectAccessForCurrentMember(state, project.id);
  const projectMembers = state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled");
  const projectWorkspaceId = project.workspaceId ?? state.auth.workspace?.id;
  const workspace = projectWorkspaceId
    ? state.auth.workspaces?.find((item) => item.id === projectWorkspaceId) ?? (state.auth.workspace?.id === projectWorkspaceId ? state.auth.workspace : undefined)
    : undefined;
  const accessibleProjectMembers = buildAccessibleProjectMembers(state, projectMembers, projectWorkspaceId);
  const accessibleMemberCount = accessibleProjectMembers.length;
  const accessibleExecutorCount = accessibleProjectMembers.filter((member) => member.roles.includes("executor")).length;
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));
  const allProjectTasks = projectTasksForProject(state, project.id);
  const overviewTasks = allProjectTasks.filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived");
  const acceptedTasks = allProjectTasks
    .filter((task) => task.status === "completed" && Boolean(task.reviewAcceptedAt))
    .sort((left, right) => (right.reviewAcceptedAt ?? "").localeCompare(left.reviewAcceptedAt ?? ""));
  const todayPlan = state.dailyPlans.find((plan) => plan.date === date);
  const allProjectTaskIds = new Set(allProjectTasks.map((task) => task.id));
  const runnableProjectTaskIds = new Set(allProjectTasks.filter((task) => task.status === "in_progress").map((task) => task.id));
  const activeProjectTaskIds = state.workSessions
    .filter((session) => session.status === "active" && runnableProjectTaskIds.has(session.taskId))
    .map((session) => session.taskId);
  if (state.activeTimer?.mode === "focus" && state.activeTimer.taskId && runnableProjectTaskIds.has(state.activeTimer.taskId)) {
    activeProjectTaskIds.push(state.activeTimer.taskId);
  }
  const filteredTasks = filterProjectTasks(allProjectTasks, filters);
  const board = buildProgressBoard(state, project.id);
  const riskSections = board.sections.filter((section) => section.kind !== "normal" && section.kind !== "pending_review" && section.tasks.length > 0);
  const riskTaskCount = riskSections.reduce((sum, section) => sum + section.tasks.length, 0);
  const taskCounts = projectTaskStatuses.reduce<Record<TaskStatus, number>>((acc, status) => {
    acc[status] = allProjectTasks.filter((task) => task.status === status).length;
    return acc;
  }, { pool: 0, committed: 0, in_progress: 0, pending_review: 0, completed: 0, split: 0, archived: 0 });
  const memberOverviewStats = [
    { label: "项目成员", value: accessibleMemberCount, helper: "有权访问项目" },
    { label: "项目负责人", value: projectMembers.filter((member) => member.roles.includes("project_owner")).length, helper: "负责验收与成员维护" },
    { label: "执行者", value: accessibleExecutorCount, helper: "可承接任务" },
    { label: "待验收", value: taskCounts.pending_review, helper: "等待负责人确认" },
  ];

  return {
    project,
    workspace,
    access,
    projectMembers,
    accessibleProjectMembers,
    executors,
    allProjectTasks,
    overviewTasks,
    acceptedTasks,
    todayPlan,
    activeProjectTaskIds,
    filteredTasks,
    board,
    riskSections,
    riskTaskCount,
    taskCounts,
    accessibleMemberCount,
    memberOverviewStats,
  };
};

export type ProjectDetailModel = NonNullable<ReturnType<typeof deriveProjectDetailModel>>;

export const buildProjectOverviewTaskBoard = (
  tasks: Task[],
  members: ProjectMember[],
  activeTaskIds?: string | Iterable<string>,
  todayTaskIds: Iterable<string> = [],
): ProjectOverviewTaskBoard => {
  const visibleTasks = tasks.filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived");
  const poolTasks = visibleTasks.filter((task) => task.status === "pool" || task.status === "committed");
  const pendingReviewTasks = visibleTasks.filter((task) => task.status === "pending_review");
  const inProgressTasks = visibleTasks.filter((task) => task.status === "in_progress");
  const activeTaskIdSet = typeof activeTaskIds === "string" ? new Set([activeTaskIds]) : new Set(activeTaskIds ?? []);
  const todayTaskIdSet = new Set(todayTaskIds);
  const todayWorkTasks = visibleTasks.filter((task) => todayTaskIdSet.has(task.id) || activeTaskIdSet.has(task.id));
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

  const canView = accessibleProjectIdsForCurrentUser(state).has(projectId);
  const member = resolveProjectMemberForAccount(state, projectId) ?? resolveMemberForProject(state, projectId);
  return {
    canView,
    canEditTasks: canView,
    canReviewTasks: canReviewProjectTasks(state, projectId),
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
    workspaceId: project.workspaceId ?? state.auth.workspace?.id,
    title,
    notes: input.notes?.trim() ?? "",
    tags: input.tags ?? [],
    projectId: project.id,
    project: project.name,
    creatorMemberId: resolveMemberIdForProject(state, project.id),
    primaryExecutorMemberId: input.primaryExecutorMemberId || undefined,
    collaboratorMemberIds: input.collaboratorMemberIds?.filter((id) => id !== input.primaryExecutorMemberId) ?? [],
    expectedStartAt: input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt,
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    stage: input.stage ?? defaultTaskStageForMode(project.taskStageMode ?? "software"),
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
