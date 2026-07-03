import { priorityWeight } from "./appModel";
import type { AppState, Task, TaskStatus } from "./types";
import type { ProjectTaskFilters } from "./projectDetailTypes";

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
