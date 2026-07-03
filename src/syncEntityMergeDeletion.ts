import type { SyncMergeRow } from "./syncEntityMergeTypes";
import type { AppState, Task } from "./types";

const matchesDeletedRow = <T extends { id: string; workspaceId?: string }>(item: T, row: SyncMergeRow) =>
  item.id === row.id && (!row.workspace_id || !item.workspaceId || item.workspaceId === row.workspace_id);

const removeByScopedId = <T extends { id: string; workspaceId?: string }>(items: T[], row: SyncMergeRow) => {
  let removed = false;
  const next = items.filter((item) => {
    const shouldRemove = matchesDeletedRow(item, row);
    if (shouldRemove) removed = true;
    return !shouldRemove;
  });
  return { items: next, removed };
};

const removeMemberReferences = (tasks: Task[], memberId: string) =>
  tasks.map((task) => ({
    ...task,
    creatorMemberId: task.creatorMemberId === memberId ? undefined : task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId === memberId ? undefined : task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => id !== memberId) ?? [],
  }));

export const applyDeletedSyncRow = (state: AppState, row: SyncMergeRow): AppState => {
  if (row.entity === "project") {
    const { items } = removeByScopedId(state.projects, row);
    return { ...state, projects: items };
  }
  if (row.entity === "project_member") {
    const { items: projectMembers, removed } = removeByScopedId(state.projectMembers, row);
    if (!removed) return state;
    return {
      ...state,
      projectMembers,
      tasks: removeMemberReferences(state.tasks, row.id),
    };
  }
  if (row.entity === "task") {
    const { items: tasks, removed } = removeByScopedId(state.tasks, row);
    if (!removed) return state;
    return {
      ...state,
      tasks,
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((taskId) => taskId !== row.id),
      })),
    };
  }
  if (row.entity === "work_session") return { ...state, workSessions: removeByScopedId(state.workSessions, row).items };
  if (row.entity === "execution_signal") return { ...state, executionSignals: removeByScopedId(state.executionSignals, row).items };
  if (row.entity === "daily_plan") return { ...state, dailyPlans: removeByScopedId(state.dailyPlans, row).items };
  if (row.entity === "focus_session") return { ...state, focusSessions: removeByScopedId(state.focusSessions, row).items };
  if (row.entity === "interruption") return { ...state, interruptions: removeByScopedId(state.interruptions, row).items };
  return state;
};
