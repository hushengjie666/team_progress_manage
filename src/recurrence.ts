import { uid } from "./seed";
import type { Task } from "./types";

export const generateRecurringTask = (task: Task, timestamp: string): Task | null => {
  const rule = task.repeatRule ?? "none";
  if (rule === "none") return null;
  const base = rule === "after_completion" ? timestamp : task.dueAt ?? task.completedAt ?? timestamp;
  const next = new Date(base);
  if (rule === "daily") next.setDate(next.getDate() + 1);
  if (rule === "weekly") next.setDate(next.getDate() + 7);
  if (rule === "interval") next.setDate(next.getDate() + Math.max(1, task.repeatIntervalDays ?? 1));
  if (rule === "weekdays") {
    const weekdays = task.repeatWeekdays?.length ? task.repeatWeekdays : [1, 2, 3, 4, 5];
    do {
      next.setDate(next.getDate() + 1);
    } while (!weekdays.includes(next.getDay()));
  }
  if (rule === "monthly") {
    const day = task.repeatDayOfMonth ?? next.getDate();
    next.setMonth(next.getMonth() + 1, Math.min(day, 28));
  }
  if (rule === "after_completion") next.setDate(next.getDate() + Math.max(1, task.repeatIntervalDays ?? 1));
  return {
    ...task,
    id: uid("task"),
    status: "pool",
    actualPomodoros: 0,
    estimateHistory: [],
    completedAt: undefined,
    recurrenceParentId: task.recurrenceParentId ?? task.id,
    nextRepeatAt: next.toISOString(),
    dueAt: task.dueAt ? next.toISOString() : undefined,
    reminderAt: task.reminderAt ? next.toISOString() : undefined,
    lastReminderSentAt: undefined,
    createdAt: timestamp,
    updatedAt: timestamp,
    sortOrder: Date.now(),
  };
};
