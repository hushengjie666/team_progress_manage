import { resolveMemberIdForProject } from "./memberIdentity";
import { todayKey, uid } from "./seed";
import { addProjectMemberToState } from "./projectMemberState";
import type { AppState, DailyPlan, Task } from "./types";
import { createDailyPlanForDate } from "./appTodayPlan";
import { currentAccountDailyPlanForWorkspaceDate, currentDailyPlanWorkspaceId, workspaceIdForTask } from "./dailyPlanScope";

export const ensurePlanInState = (
  state: AppState,
  date: string,
  timestamp: string,
  workspaceId = currentDailyPlanWorkspaceId(state),
): { state: AppState; plan: DailyPlan } => {
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  if (existing) return { state, plan: existing };

  const plan = createDailyPlanForDate(state, date, timestamp, workspaceId);
  return { state: { ...state, dailyPlans: [plan, ...state.dailyPlans], updatedAt: timestamp }, plan };
};

export const ensureTodayPlanInState = (state: AppState, timestamp: string, workspaceId = currentDailyPlanWorkspaceId(state)) =>
  ensurePlanInState(state, todayKey(), timestamp, workspaceId);

export const currentProjectMemberIdForTask = (state: AppState, task: Task) => {
  return resolveMemberIdForProject(state, task.projectId);
};

const taskHasAssignee = (task: Task) =>
  Boolean(task.primaryExecutorMemberId || (task.collaboratorMemberIds ?? []).length > 0);

const currentWorkspaceMembershipForTask = (state: AppState, task: Task) => {
  const account = state.auth.account;
  if (!account) return undefined;
  const project = state.projects.find((item) => item.id === task.projectId);
  const workspaceId = project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
  return state.auth.workspaceMemberships?.find(
    (membership) =>
      membership.status === "active" &&
      membership.accountId === account.id &&
      (!workspaceId || membership.workspaceId === workspaceId),
  ) ?? (
    state.auth.membership?.status === "active" &&
    state.auth.membership.accountId === account.id &&
    (!workspaceId || state.auth.membership.workspaceId === workspaceId)
      ? state.auth.membership
      : undefined
  );
};

export const ensureCurrentProjectMemberForTask = (state: AppState, task: Task, timestamp: string) => {
  const currentMemberId = currentProjectMemberIdForTask(state, task);
  if (currentMemberId) return { state, memberId: currentMemberId };
  const account = state.auth.account;
  const membership = currentWorkspaceMembershipForTask(state, task);
  if (!account || !membership) return { state, memberId: undefined };
  const project = state.projects.find((item) => item.id === task.projectId);
  const nextState = addProjectMemberToState(
    state,
    task.projectId,
    account.name || membership.name,
    account.email || membership.email,
    ["executor"],
    timestamp,
    uid,
    {
      accountId: account.id,
      workspaceId: project?.workspaceId ?? task.workspaceId ?? membership.workspaceId,
    },
  );
  return { state: nextState, memberId: currentProjectMemberIdForTask(nextState, task) };
};

export const claimTaskForCurrentMemberIfUnassigned = (state: AppState, task: Task) => {
  if (taskHasAssignee(task)) return task.primaryExecutorMemberId;
  return currentProjectMemberIdForTask(state, task);
};

export const addTaskToTodayInState = (state: AppState, taskId: string, timestamp: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const stateWithMember = taskHasAssignee(task)
    ? state
    : ensureCurrentProjectMemberForTask(state, task, timestamp).state;
  const taskForPlan = stateWithMember.tasks.find((item) => item.id === taskId) ?? task;
  const { state: withPlan, plan } = ensureTodayPlanInState(stateWithMember, timestamp, workspaceIdForTask(stateWithMember, taskForPlan));
  const committedTaskIds = Array.from(new Set([...plan.committedTaskIds, taskId]));
  return {
    ...withPlan,
    tasks: withPlan.tasks.map((item) =>
      item.id === taskId
        ? {
            ...item,
            primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(withPlan, item),
            status: item.status === "pool" ? "committed" as const : item.status,
            updatedAt: timestamp,
          }
        : item,
    ),
    dailyPlans: withPlan.dailyPlans.map((item) => (item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item)),
    updatedAt: timestamp,
  };
};

export const claimTodayPlanTasksForCurrentMemberInState = (state: AppState, plan: DailyPlan, timestamp: string) => {
  let nextState = state;
  let changed = false;
  for (const taskId of plan.committedTaskIds) {
    const task = nextState.tasks.find((item) => item.id === taskId);
    if (!task || taskHasAssignee(task)) continue;
    const withMember = ensureCurrentProjectMemberForTask(nextState, task, timestamp);
    if (!withMember.memberId) continue;
    nextState = {
      ...withMember.state,
      tasks: withMember.state.tasks.map((item) =>
        item.id === task.id ? { ...item, primaryExecutorMemberId: withMember.memberId, updatedAt: timestamp } : item,
      ),
      updatedAt: timestamp,
    };
    changed = true;
  }
  return changed ? nextState : state;
};

export const removeTaskFromTodayQueueInState = (state: AppState, taskId: string, timestamp: string) => ({
  ...state,
  tasks: state.tasks.map((task) =>
    task.id === taskId && task.status === "committed" ? { ...task, status: "pool" as const, updatedAt: timestamp } : task,
  ),
  dailyPlans: state.dailyPlans.map((plan) =>
    plan.committedTaskIds.includes(taskId)
      ? { ...plan, committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId), updatedAt: timestamp }
      : plan,
  ),
  updatedAt: timestamp,
});
