import { dailyCompletionRate, estimateDeltaLabel, suggestedCapacity } from "./domain";
import type { AppState, ReportFilter, ReviewSummary, Task } from "./types";

export const dateRangeForReport = (filter: ReportFilter, now = new Date()) => {
  const end = new Date(now);
  const start = new Date(now);
  if (filter.range === "7d") start.setDate(end.getDate() - 6);
  if (filter.range === "30d") start.setDate(end.getDate() - 29);
  if (filter.range === "quarter") start.setMonth(end.getMonth() - 3);
  if (filter.range === "year") start.setMonth(0, 1);
  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const taskMatchesReportFilter = (task: Task | undefined, filter: ReportFilter) => {
  if (!task) return filter.project === "all" && filter.tag === "all" && filter.taskId === "all";
  return (
    (filter.project === "all" || task.project === filter.project) &&
    (filter.tag === "all" || task.tags.includes(filter.tag)) &&
    (filter.taskId === "all" || task.id === filter.taskId)
  );
};

export const filteredStateForReport = (state: AppState, filter: ReportFilter, now = new Date()): AppState => {
  const { start, end } = dateRangeForReport(filter, now);
  const inRange = (iso?: string) => {
    if (!iso) return false;
    const time = new Date(iso).getTime();
    return !Number.isNaN(time) && time >= start.getTime() && time <= end.getTime();
  };
  const taskIds = new Set(state.tasks.filter((task) => taskMatchesReportFilter(task, filter)).map((task) => task.id));
  return {
    ...state,
    focusSessions: state.focusSessions.filter((session) => inRange(session.startedAt) && (!session.taskId || taskIds.has(session.taskId))),
    interruptions: state.interruptions.filter((item) => inRange(item.createdAt) && (!item.taskId || taskIds.has(item.taskId))),
    tasks: state.tasks.filter((task) => taskMatchesReportFilter(task, filter)),
    dailyPlans: state.dailyPlans.filter((plan) => {
      const time = new Date(`${plan.date}T12:00:00`).getTime();
      return time >= start.getTime() && time <= end.getTime();
    }),
  };
};

export const reviewSummary = (state: AppState, filter: ReportFilter): ReviewSummary => {
  const filtered = filteredStateForReport(state, filter);
  const completedPomodoros = filtered.focusSessions.filter((session) => session.mode === "focus" && session.outcome === "completed").length;
  const commitmentRates = filtered.dailyPlans.map((plan) => dailyCompletionRate(state, plan)).filter((value) => value > 0);
  const commitmentRate = commitmentRates.length
    ? Math.round(commitmentRates.reduce((sum, value) => sum + value, 0) / commitmentRates.length)
    : 0;
  const estimateDelta = filtered.tasks
    .filter((task) => task.status === "completed")
    .reduce((sum, task) => sum + (task.actualPomodoros || 0) - task.estimatePomodoros, 0);
  const hourBuckets = filtered.interruptions.reduce((map, item) => {
    const hour = new Date(item.createdAt).getHours();
    if (!Number.isNaN(hour)) map.set(hour, (map.get(hour) ?? 0) + 1);
    return map;
  }, new Map<number, number>());
  const topHour = Array.from(hourBuckets.entries()).sort((left, right) => right[1] - left[1])[0]?.[0];
  const underProjects = Array.from(
    filtered.tasks
      .filter((task) => (task.actualPomodoros || 0) - task.estimatePomodoros >= 2)
      .reduce((map, task) => map.set(task.project, (map.get(task.project) ?? 0) + 1), new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([project]) => project);
  const rangeLabel = filter.range === "7d" ? "近 7 天" : filter.range === "30d" ? "近 30 天" : filter.range === "quarter" ? "近一季度" : "今年";
  return {
    rangeLabel,
    completedPomodoros,
    commitmentRate,
    estimateDelta,
    interruptionCount: filtered.interruptions.length,
    topInterruptionHour: topHour === undefined ? undefined : `${String(topHour).padStart(2, "0")}:00`,
    underestimatedProjects: underProjects,
    capacityAdvice: `下个计划日建议承诺 ${suggestedCapacity(state)} 个番茄；总体估算${estimateDeltaLabel(0, estimateDelta)}。`,
  };
};
