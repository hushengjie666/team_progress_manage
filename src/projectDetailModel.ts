import { nowIso } from "./appModel";
import {
  accessibleProjectIdsForCurrentUser,
  buildAccessibleProjectMembers,
  canReviewProjectTasks,
  resolveProjectMemberForAccount,
} from "./accessControl";
import { resolveMemberForProject } from "./memberIdentity";
import { buildProgressBoard } from "./progressBoard";
import type { Account, AppState, TaskStatus } from "./types";
import { filterProjectTasks, projectTasksForProject } from "./projectDetailTaskFilters";
import type { ProjectAccess, ProjectTaskFilters } from "./projectDetailTypes";

const projectTaskStatuses: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];

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

export const deriveProjectDetailModel = (
  state: AppState,
  projectId: string,
  filters: ProjectTaskFilters,
  date = nowIso().slice(0, 10),
  accounts: Account[] = [],
) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) return undefined;

  const access = projectAccessForCurrentMember(state, project.id);
  const projectMembers = state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled");
  const projectWorkspaceId = project.workspaceId ?? state.auth.workspace?.id;
  const workspace = projectWorkspaceId
    ? state.auth.workspaces?.find((item) => item.id === projectWorkspaceId) ?? (state.auth.workspace?.id === projectWorkspaceId ? state.auth.workspace : undefined)
    : undefined;
  const accessibleProjectMembers = buildAccessibleProjectMembers(state, projectMembers, projectWorkspaceId, accounts);
  const accessibleMemberCount = accessibleProjectMembers.length;
  const accessibleExecutorCount = accessibleProjectMembers.filter((member) => member.roles.includes("executor")).length;
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));
  const allProjectTasks = projectTasksForProject(state, project.id);
  const overviewTasks = allProjectTasks.filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived");
  const acceptedTasks = allProjectTasks
    .filter((task) => task.status === "completed" && Boolean(task.reviewAcceptedAt))
    .sort((left, right) => (right.reviewAcceptedAt ?? "").localeCompare(left.reviewAcceptedAt ?? ""));
  const todayPlan = state.dailyPlans.find((plan) => plan.date === date);
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
