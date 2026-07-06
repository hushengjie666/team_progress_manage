import { getTodayPlan, today } from "../../src/appModel.js";
import { currentAccountDailyPlansForDate } from "../../src/dailyPlanScope.js";
import { buildMemberStatusColumns } from "../../src/memberStatusColumns.js";
import { buildProgressBoard } from "../../src/progressBoard.js";
import { sortedByUpdatedAt } from "../../src/workSessionTransitions.js";
import type { AppState, DailyPlan, Project, ProjectMember, Task, TaskStatus, WorkSession } from "../../src/types.js";

export type TaskListFilter = {
  projectId?: string;
  status?: TaskStatus | "all";
  assigneeMemberId?: string;
  query?: string;
  includeArchived?: boolean;
  includeSplit?: boolean;
};

const workspaceName = (state: AppState, workspaceId?: string) =>
  workspaceId ? state.auth.workspaces?.find((workspace) => workspace.id === workspaceId)?.name ?? state.auth.workspace?.name : undefined;

const projectForTask = (state: AppState, task: Task) =>
  state.projects.find((project) => project.id === task.projectId);

const memberName = (state: AppState, memberId?: string) =>
  memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : undefined;

export const compactProject = (state: AppState, project: Project) => ({
  id: project.id,
  workspaceId: project.workspaceId,
  workspaceName: workspaceName(state, project.workspaceId),
  name: project.name,
  description: project.description,
  defaultExpectedStartHours: project.defaultExpectedStartHours,
  taskStageMode: project.taskStageMode,
  archivedAt: project.archivedAt,
  taskCount: state.tasks.filter((task) => task.projectId === project.id && task.status !== "archived" && task.status !== "split").length,
  memberCount: state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled").length,
  updatedAt: project.updatedAt,
});

export const compactMember = (state: AppState, member: ProjectMember) => ({
  id: member.id,
  workspaceId: member.workspaceId,
  workspaceName: workspaceName(state, member.workspaceId),
  projectId: member.projectId,
  projectName: state.projects.find((project) => project.id === member.projectId)?.name,
  accountId: member.accountId,
  name: member.name,
  email: member.email,
  roles: member.roles,
  status: member.status ?? "active",
  updatedAt: member.updatedAt,
});

export const compactTask = (state: AppState, task: Task) => {
  const project = projectForTask(state, task);
  return {
    id: task.id,
    workspaceId: task.workspaceId ?? project?.workspaceId,
    workspaceName: workspaceName(state, task.workspaceId ?? project?.workspaceId),
    title: task.title,
    notes: task.notes,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    primaryExecutorName: memberName(state, task.primaryExecutorMemberId),
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    status: task.status,
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    progressPercent: task.progressPercent ?? 0,
    progressNote: task.progressNote,
    estimatePomodoros: task.estimatePomodoros,
    actualPomodoros: task.actualPomodoros,
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays,
    subtasks: task.subtasks,
    reviewSubmittedAt: task.reviewSubmittedAt,
    reviewAcceptedAt: task.reviewAcceptedAt,
    reviewReturnedAt: task.reviewReturnedAt,
    reviewReturnReason: task.reviewReturnReason,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt,
  };
};

const taskMatchesFilter = (task: Task, filter: TaskListFilter) => {
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if (!filter.includeArchived && task.status === "archived") return false;
  if (!filter.includeSplit && task.status === "split") return false;
  if (filter.status && filter.status !== "all" && task.status !== filter.status) return false;
  if (filter.assigneeMemberId) {
    const collaborators = task.collaboratorMemberIds ?? [];
    if (task.primaryExecutorMemberId !== filter.assigneeMemberId && !collaborators.includes(filter.assigneeMemberId)) return false;
  }
  const query = filter.query?.trim().toLowerCase();
  if (query && !`${task.title} ${task.notes} ${task.project} ${task.tags.join(" ")}`.toLowerCase().includes(query)) return false;
  return true;
};

export const listProjectViews = (state: AppState) =>
  sortedByUpdatedAt(state.projects.filter((project) => !project.archivedAt)).map((project) => compactProject(state, project));

export const listTaskViews = (state: AppState, filter: TaskListFilter = {}) =>
  sortedByUpdatedAt(state.tasks.filter((task) => taskMatchesFilter(task, filter))).map((task) => compactTask(state, task));

export const taskDetailView = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return {
    ...compactTask(state, task),
    projectDetail: state.projects.find((project) => project.id === task.projectId),
    workSessions: state.workSessions.filter((session) => session.taskId === taskId),
    executionSignals: state.executionSignals.filter((signal) => signal.taskId === taskId),
    interruptions: state.interruptions.filter((interruption) => interruption.taskId === taskId),
  };
};

const planTasks = (state: AppState, plan: DailyPlan) =>
  plan.committedTaskIds
    .map((taskId) => state.tasks.find((task) => task.id === taskId))
    .filter((task): task is Task => Boolean(task))
    .map((task) => compactTask(state, task));

export const dailyPlanView = (state: AppState, date = today()) => {
  const plans = date === today() ? currentAccountDailyPlansForDate(state, date) : currentAccountDailyPlansForDate(state, date);
  const combined = date === today() ? getTodayPlan(state) : plans[0];
  return {
    date,
    combined: combined
      ? {
          ...combined,
          tasks: planTasks(state, combined),
        }
      : undefined,
    plans: plans.map((plan) => ({
      ...plan,
      workspaceName: workspaceName(state, plan.workspaceId),
      tasks: planTasks(state, plan),
    })),
  };
};

export const todayWorkbenchView = (state: AppState, projectId?: string, date = today()) =>
  buildMemberStatusColumns(state, projectId, date).map((member) => ({
    id: member.id,
    name: member.name,
    accountId: member.accountId,
    email: member.email,
    roles: member.roles,
    projectIds: member.projectIds,
    workspaceIds: member.workspaceIds,
    runningTask: member.runningTask ? compactTask(state, member.runningTask) : undefined,
    displayedTasks: member.displayedTasks.map((task) => compactTask(state, task)),
    projectTaskGroups: member.projectTaskGroups.map((group) => ({
      ...group,
      tasks: group.tasks.map((task) => compactTask(state, task)),
    })),
  }));

const sessionView = (state: AppState, session: WorkSession) => ({
  ...session,
  task: state.tasks.find((task) => task.id === session.taskId)
    ? compactTask(state, state.tasks.find((task) => task.id === session.taskId)!)
    : undefined,
  executorName: memberName(state, session.executorMemberId),
});

export const activeWorkView = (state: AppState, projectId?: string) =>
  sortedByUpdatedAt(state.workSessions.filter((session) => {
    if (session.status !== "active" && session.status !== "paused") return false;
    if (!projectId) return true;
    return state.tasks.some((task) => task.id === session.taskId && task.projectId === projectId);
  })).map((session) => sessionView(state, session));

export const projectOverviewView = (state: AppState, projectId: string) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const tasks = state.tasks.filter((task) => task.projectId === projectId);
  const statusCounts = tasks.reduce<Record<string, number>>((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const board = buildProgressBoard(state, projectId);
  return {
    project: compactProject(state, project),
    statusCounts,
    progress: board.projectProgress,
    activeSessions: board.activeSessions,
    riskSections: board.sections.filter((section) => section.kind !== "normal" && section.tasks.length > 0),
    members: state.projectMembers.filter((member) => member.projectId === projectId).map((member) => compactMember(state, member)),
  };
};

export const riskTasksView = (state: AppState, projectId?: string) => {
  const projects = projectId ? state.projects.filter((project) => project.id === projectId) : state.projects.filter((project) => !project.archivedAt);
  return projects.flatMap((project) =>
    buildProgressBoard(state, project.id).sections
      .filter((section) => section.kind !== "normal")
      .flatMap((section) => section.tasks.map((task) => ({ projectId: project.id, projectName: project.name, section: section.kind, ...task }))),
  );
};

export const searchView = (state: AppState, query: string, limit = 10) => {
  const normalized = query.trim().toLowerCase();
  const includes = (...values: Array<string | undefined>) => values.join(" ").toLowerCase().includes(normalized);
  if (!normalized) return { projects: [], members: [], tasks: [] };
  return {
    projects: state.projects.filter((project) => includes(project.name, project.description)).slice(0, limit).map((project) => compactProject(state, project)),
    members: state.projectMembers.filter((member) => includes(member.name, member.email)).slice(0, limit).map((member) => compactMember(state, member)),
    tasks: state.tasks.filter((task) => includes(task.title, task.notes, task.project, task.tags.join(" "))).slice(0, limit).map((task) => compactTask(state, task)),
  };
};

export const dailySummaryView = (state: AppState, date = today()) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  const taskIds = new Set(plans.flatMap((plan) => plan.committedTaskIds));
  const sessions = state.workSessions.filter((session) => taskIds.has(session.taskId) || session.startedAt.slice(0, 10) === date);
  return {
    date,
    plans: plans.map((plan) => ({ ...plan, workspaceName: workspaceName(state, plan.workspaceId), tasks: planTasks(state, plan) })),
    totals: {
      plans: plans.length,
      tasks: taskIds.size,
      completedTasks: state.tasks.filter((task) => taskIds.has(task.id) && task.status === "completed").length,
      workSessions: sessions.length,
      completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0),
    },
    workSessions: sessions.map((session) => sessionView(state, session)),
    interruptions: state.interruptions.filter((interruption) => interruption.createdAt.slice(0, 10) === date),
  };
};
