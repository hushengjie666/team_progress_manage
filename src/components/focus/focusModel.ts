import { canManageWorkspace, workspaceIdForProject } from "../../workspaceAccess";
import { calculateRemaining, completedFocusSessions } from "../../domain";
import type { ActiveTimer, AppState, SessionMode, Task } from "../../types";

export type FocusTaskGroup = {
  projectId: string;
  project: string;
  tasks: Task[];
};

export const focusProgressPercent = (active?: ActiveTimer) =>
  active ? 100 - (active.remaining / active.duration) * 100 : 0;

export const displayRemainingForTimer = (active: ActiveTimer, now = new Date()) => {
  return calculateRemaining(active, now);
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

export const buildFocusTaskList = (committedTasks: Task[]) =>
  committedTasks
    .filter(isVisibleFocusTask)
    .sort((left, right) => focusTaskStatusRank(left) - focusTaskStatusRank(right) || left.sortOrder - right.sortOrder);

// Status changes can reorder tasks; project positions follow their earliest queue order.
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
  }, []).sort((left, right) =>
    Math.min(...left.tasks.map((task) => task.sortOrder)) - Math.min(...right.tasks.map((task) => task.sortOrder)) ||
    left.projectId.localeCompare(right.projectId));

export function focusCompletionLabel(state: AppState, task: Task) {
  if (task.status !== "committed" && task.status !== "in_progress") return;
  const project = state.projects.find((item) => item.id === task.projectId);
  const account = state.auth.account;
  if (!project || !account) return;
  const workspaceId = task.workspaceId ?? workspaceIdForProject(state, project);
  const canSubmit = (workspaceId && canManageWorkspace(state, workspaceId)) || state.projectMembers.some((member) => {
    if (member.projectId !== project.id || member.accountId !== account.id || member.status !== "active") return false;
    const assigned = task.primaryExecutorMemberId === member.id || task.collaboratorMemberIds?.includes(member.id);
    return member.roles.includes("project_owner") || (member.roles.includes("executor") && assigned);
  });
  if (!canSubmit) return;
  return project.autoAcceptCompletedTasks === false ? "提交验收" : "完成";
}
