import { todayKey } from "../../seed";
import type { AppState, CalendarDaySummary, DailyReview, Task } from "../../types";

const taskById = (tasks: Task[], ids: string[]) =>
  ids.map((id) => tasks.find((task) => task.id === id)).filter((task): task is Task => Boolean(task));

export const calendarReviewLabel = (review?: DailyReview) => {
  if (review?.mood === "low") return "偏低";
  if (review?.mood === "normal") return "普通";
  if (review?.mood === "good") return "良好";
  if (review?.mood === "great") return "优秀";
  return "未回顾";
};

export const buildCalendarDayDetailModel = (state: AppState, selected?: CalendarDaySummary) => {
  const selectedPlan = selected ? state.dailyPlans.find((plan) => plan.date === selected.date) : undefined;
  const selectedTasks = taskById(state.tasks, selected?.committedTaskIds ?? []);
  const overdueTasks = taskById(state.tasks, selected?.overdueTaskIds ?? []);
  const reminderTasks = taskById(state.tasks, selected?.reminderTaskIds ?? []);
  const selectedCommittedTaskIds = new Set(selected?.committedTaskIds ?? []);
  const schedulableTasks = state.tasks.filter((task) =>
    task.status !== "completed" &&
    task.status !== "split" &&
    task.status !== "archived" &&
    !selectedCommittedTaskIds.has(task.id),
  );
  const selectedDateKey = selected?.date ?? todayKey();
  const selectedSessions = state.focusSessions.filter((item) => item.startedAt.slice(0, 10) === selectedDateKey);
  const selectedInterruptions = state.interruptions.filter((item) => item.createdAt.slice(0, 10) === selectedDateKey);
  const review = selectedPlan?.review as DailyReview | undefined;

  return {
    selectedDateKey,
    selectedPlan,
    selectedTasks,
    overdueTasks,
    reminderTasks,
    schedulableTasks,
    selectedSessions,
    selectedInterruptions,
    review,
    reviewLabel: calendarReviewLabel(review),
  };
};
