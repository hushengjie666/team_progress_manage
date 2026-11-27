import type { AppState, Task } from "./types";

type CachedDailyTask = Pick<Task, "id" | "workspaceId" | "updatedAt" | "isDaily" | "dailyCompletedDates" | "dailyRemovedDates">;
type DailyTaskCache = { accountId: string; serverUrl: string; tasks: CachedDailyTask[] };

export function dailyTaskCache(state: AppState): DailyTaskCache | undefined {
  const accountId = state.auth.account?.id;
  if (!accountId || state.auth.status !== "authenticated") return;
  const tasks = state.tasks.filter((task) => task.isDaily || task.dailyCompletedDates || task.dailyRemovedDates)
    .map(({ id, workspaceId, updatedAt, isDaily, dailyCompletedDates, dailyRemovedDates }) => ({
      id, workspaceId, updatedAt, isDaily, dailyCompletedDates, dailyRemovedDates,
    }));
  return { accountId, serverUrl: state.backend.serverUrl, tasks };
}

// Only hydrate fields for an accessible task returned by the server at the exact cached revision.
export function restoreDailyTaskFields(tasks: Task[], cache: DailyTaskCache | undefined, accountId: string, serverUrl: string) {
  if (!cache || cache.accountId !== accountId || cache.serverUrl !== serverUrl || !Array.isArray(cache.tasks)) return tasks;
  const cached = new Map(cache.tasks.filter((row) => row && typeof row.id === "string").map((row) => [row.id, row]));
  return tasks.map((task) => {
    const row = cached.get(task.id);
    if (!row || row.workspaceId !== task.workspaceId || row.updatedAt !== task.updatedAt || task.isDaily !== undefined) return task;
    if (typeof row.isDaily !== "boolean" || (row.dailyCompletedDates && !Array.isArray(row.dailyCompletedDates))) return task;
    return { ...task, isDaily: row.isDaily, dailyCompletedDates: task.dailyCompletedDates ?? row.dailyCompletedDates,
      dailyRemovedDates: task.dailyRemovedDates ?? row.dailyRemovedDates };
  });
}
