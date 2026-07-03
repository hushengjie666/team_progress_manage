import { abortedSessionsOnDate, interruptionsOnDate, planForDate, sessionsOnDate } from "./domain";
import { todayKey } from "./seed";
import type { AppState, CalendarDaySummary } from "./types";

const dayMs = 86_400_000;

export const calendarSummaries = (state: AppState, startDate: string, days: number): CalendarDaySummary[] => {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  return Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getTime() + index * dayMs);
    const key = todayKey(date);
    const plan = planForDate(state, key);
    const dueCutoff = `${key}T23:59:59.999Z`;
    return {
      date: key,
      committedTaskIds: plan?.committedTaskIds ?? [],
      completedPomodoros: sessionsOnDate(state, key).length,
      plannedPomodoros: (plan?.committedTaskIds ?? [])
        .map((id) => state.tasks.find((task) => task.id === id)?.estimatePomodoros ?? 0)
        .reduce((sum, value) => sum + value, 0),
      interruptionCount: interruptionsOnDate(state, key).length,
      abortedPomodoros: abortedSessionsOnDate(state, key).length,
      overdueTaskIds: state.tasks
        .filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived" && task.dueAt && task.dueAt <= dueCutoff && task.dueAt.slice(0, 10) <= key)
        .map((task) => task.id),
      reminderTaskIds: state.tasks.filter((task) => task.reminderAt?.slice(0, 10) === key).map((task) => task.id),
      reviewed: Boolean(plan?.reviewedAt),
      reviewedAt: plan?.reviewedAt,
      review: plan?.review,
    };
  });
};
