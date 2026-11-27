import { accessibleProjectIdsForCurrentUser, workspaceForProject } from "./accessControl";
import { resolveProjectMemberForAccount } from "./projectAccess";
import type { AppState, DailyPlan, Task } from "./types";

export function dailyTaskBelongsToAccount(state: AppState, task: Task, accessible = accessibleProjectIdsForCurrentUser(state)) {
  const account = state.auth.account;
  if (!account || !task.isDaily || task.status === "archived" || task.status === "split" || !accessible.has(task.projectId)) return false;
  const project = state.projects.find((item) => item.id === task.projectId);
  if (!project || project.archivedAt) return false;
  const member = resolveProjectMemberForAccount(state, project.id);
  if (task.primaryExecutorMemberId || task.collaboratorMemberIds?.length) {
    return Boolean(member && (member.id === task.primaryExecutorMemberId || task.collaboratorMemberIds?.includes(member.id)));
  }
  const workspace = workspaceForProject(state, project);
  return (task.creatorMemberId ? member?.id === task.creatorMemberId : task.creatorAccountId === account.id) ||
    (workspace?.type === "private" && workspace.ownerAccountId === account.id);
}

export function withDailyTasks(state: AppState, plan: DailyPlan): DailyPlan {
  const daily = state.tasks.filter((task) => task.isDaily);
  if (!daily.length) return plan;
  const accessible = accessibleProjectIdsForCurrentUser(state);
  const accountId = state.auth.account?.id;
  const ids = new Set(plan.committedTaskIds);
  for (const task of daily) {
    if (accountId && dailyTaskBelongsToAccount(state, task, accessible) && task.dailyRemovedDates?.[accountId] !== plan.date) {
      ids.add(task.id);
    } else {
      ids.delete(task.id);
    }
  }
  return { ...plan, committedTaskIds: [...ids] };
}

// The durable status describes the task itself. A check-in completes one occurrence.
export function dailyTaskForDate(task: Task, date: string): Task {
  if (!task.isDaily || task.status === "archived" || task.status === "split") return task;
  if (task.dailyCompletedDates?.includes(date)) return { ...task, status: "completed", progressPercent: 100 };
  return task.status === "in_progress" ? task : { ...task, status: "committed" };
}
