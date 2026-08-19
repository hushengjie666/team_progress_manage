import { priorityWeight, type TaskFilters } from "./appModel";
import type { AppState, DailyPlan, Task } from "./types";

export const poolTasksForFilters = (state: AppState, todayPlan: DailyPlan, taskFilters: TaskFilters): Task[] => {
  const query = taskFilters.query.trim().toLowerCase();
  const filtered = state.tasks.filter((task) => {
    const matchesQuery =
      !query ||
      task.title.toLowerCase().includes(query) ||
      task.notes.toLowerCase().includes(query) ||
      task.project.toLowerCase().includes(query) ||
      task.tags.some((tag) => tag.toLowerCase().includes(query));

    return (
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived" &&
      !todayPlan.committedTaskIds.includes(task.id) &&
      matchesQuery &&
      (taskFilters.project === "all" || task.project === taskFilters.project) &&
      (taskFilters.tag === "all" || task.tags.includes(taskFilters.tag)) &&
      (taskFilters.priority === "all" || task.priority === taskFilters.priority)
    );
  });

  return [...filtered].sort((left, right) => {
    if (taskFilters.sort === "createdAt") {
      return right.createdAt.localeCompare(left.createdAt) || right.sortOrder - left.sortOrder;
    }
    if (taskFilters.sort === "dueAt") return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
    if (taskFilters.sort === "priority") return priorityWeight[right.priority] - priorityWeight[left.priority];
    if (taskFilters.sort === "estimate") return right.estimatePomodoros - left.estimatePomodoros;
    return left.sortOrder - right.sortOrder;
  });
};
