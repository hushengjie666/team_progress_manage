import { abortedSessionsOnDate, dailyCompletionRate, estimateDeltaLabel, interruptionsOnDate, planForDate, sessionsOnDate, suggestedCapacity } from "./domain";
import { todayKey, uid } from "./seed";
import type {
  AppState,
  CalendarDaySummary,
  ParsedQuickInput,
  ReportFilter,
  ReviewSummary,
  Task,
  TaskTemplate,
} from "./types";

const dayMs = 86_400_000;

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
    strictViolations: state.strictViolations.filter((item) => inRange(item.createdAt) && (!item.taskId || taskIds.has(item.taskId))),
    tasks: state.tasks.filter((task) => taskMatchesReportFilter(task, filter)),
    dailyPlans: state.dailyPlans.filter((plan) => {
      const time = new Date(`${plan.date}T12:00:00`).getTime();
      return time >= start.getTime() && time <= end.getTime();
    }),
  };
};

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
        .filter((task) => task.status !== "completed" && task.status !== "archived" && task.dueAt && task.dueAt <= dueCutoff && task.dueAt.slice(0, 10) <= key)
        .map((task) => task.id),
      reminderTaskIds: state.tasks.filter((task) => task.reminderAt?.slice(0, 10) === key).map((task) => task.id),
      reviewed: Boolean(plan?.reviewedAt),
      reviewedAt: plan?.reviewedAt,
      review: plan?.review,
    };
  });
};

export const instantiateTemplate = (template: TaskTemplate, timestamp = new Date().toISOString()): Task => ({
  id: uid("task"),
  title: template.name,
  notes: template.description,
  tags: template.tags,
  project: template.project,
  priority: template.priority,
  severity: template.severity,
  estimatePomodoros: template.estimatePomodoros,
  status: "pool",
  repeatRule: template.repeatRule ?? "none",
  subtasks: template.subtasks.map((title) => ({
    id: uid("subtask"),
    title,
    completed: false,
    createdAt: timestamp,
  })),
  sortOrder: Date.now(),
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});

const parseDateToken = (input: string, baseDate: Date) => {
  const due = new Date(baseDate);
  const hourMatch = input.match(/(?:今天|明天|后天)?\s*(\d{1,2})[点:：](\d{1,2})?/);
  if (input.includes("明天")) due.setDate(due.getDate() + 1);
  if (input.includes("后天")) due.setDate(due.getDate() + 2);
  if (hourMatch) {
    due.setHours(Number(hourMatch[1]), Number(hourMatch[2] ?? 0), 0, 0);
    return due.toISOString();
  }
  if (input.includes("明天") || input.includes("后天") || input.includes("今天")) {
    due.setHours(18, 0, 0, 0);
    return due.toISOString();
  }
  return undefined;
};

export const parseQuickInput = (input: string, baseDate = new Date()): ParsedQuickInput => {
  const tags = Array.from(input.matchAll(/#([\p{L}\p{N}_-]+)/gu)).map((match) => match[1]);
  const estimateMatch = input.match(/(?:^|\s)(\d+)\s*(?:p|P|番茄|个番茄)(?:\s|$)/);
  const projectMatch = input.match(/@([\p{L}\p{N}_-]+)/u);
  const priority = /!{3}|紧急/.test(input) ? "urgent" : /!{2}|高优先/.test(input) ? "high" : undefined;
  const title = input
    .replace(/#([\p{L}\p{N}_-]+)/gu, "")
    .replace(/@([\p{L}\p{N}_-]+)/gu, "")
    .replace(/(?:^|\s)(\d+)\s*(?:p|P|番茄|个番茄)(?:\s|$)/g, " ")
    .replace(/今天|明天|后天|\d{1,2}[点:：]\d{0,2}|!{2,3}|紧急|高优先/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return {
    title: title || input.trim(),
    tags,
    project: projectMatch?.[1],
    estimatePomodoros: estimateMatch ? Math.max(1, Number(estimateMatch[1])) : 1,
    dueAt: parseDateToken(input, baseDate),
    priority,
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
