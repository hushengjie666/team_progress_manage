import {
  buildInsights,
  completedFocusSessions,
  deriveRewardState,
  estimateDeltaLabel,
  focusQuality,
  interruptionHotspots,
  nextActions,
  sessionsOnDate,
} from "./domain";
import { filteredStateForReport, reviewSummary } from "./planning";
import { todayKey } from "./seed";
import type { AppState, ReportFilter } from "./types";

const defaultReportFilter: ReportFilter = { range: "30d", project: "all", tag: "all", taskId: "all" };

export const buildReportsViewModel = (state: AppState) => {
  const filter = state.settings.reportFilter ?? defaultReportFilter;
  const reportState = filteredStateForReport(state, filter);
  const rewardState = deriveRewardState(state);
  const insights = buildInsights(reportState);
  const quality = focusQuality(reportState);
  const actions = nextActions(state);
  const hotspots = interruptionHotspots(reportState, 4);
  const summary = reviewSummary(state, filter);
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  if (state.tasks.some((task) => task.tags.length === 0)) {
    tags.push("无标签");
    tags.sort();
  }

  const days = Array.from({ length: 14 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (13 - index));
    const key = todayKey(date);
    return { key, count: sessionsOnDate(reportState, key).length };
  });
  const maxCount = Math.max(1, ...days.map((day) => day.count));
  const completedTasks = reportState.tasks.filter((task) => task.status === "completed");
  const totalEstimates = completedTasks.reduce((sum, task) => sum + task.estimatePomodoros, 0);
  const totalActual = completedTasks.reduce(
    (sum, task) => sum + reportState.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length,
    0,
  );
  const estimateSummary = estimateDeltaLabel(totalEstimates, totalActual);
  const completedWithActual = completedTasks.map((task) => ({
    task,
    actual:
      task.actualPomodoros ||
      reportState.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length,
  }));
  const inaccurateTasks = [...completedWithActual]
    .map(({ task, actual }) => ({ task, actual, delta: actual - task.estimatePomodoros }))
    .sort((left, right) => Math.abs(right.delta) - Math.abs(left.delta))
    .slice(0, 6);
  const completedSessions = completedFocusSessions(reportState);
  const projectDistribution = Array.from(
    completedSessions.reduce((map, session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      const key = task?.project ?? "无项目";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).sort((left, right) => right[1] - left[1]);
  const tagDistribution = Array.from(
    completedSessions.reduce((map, session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      const tagsForSession = task?.tags.length ? task.tags : ["无标签"];
      for (const tag of tagsForSession) map.set(tag, (map.get(tag) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8);
  const maxDistribution = Math.max(1, ...projectDistribution.map((item) => item[1]), ...tagDistribution.map((item) => item[1]));
  const estimateDays = days.map((day) => {
    const completedOnDay = completedTasks.filter((task) => task.completedAt?.slice(0, 10) === day.key);
    const estimate = completedOnDay.reduce((sum, task) => sum + task.estimatePomodoros, 0);
    const actual = completedOnDay.reduce((sum, task) => sum + (task.actualPomodoros ?? 0), 0);
    return { key: day.key, delta: actual - estimate };
  });
  const interruptions = reportState.interruptions.reduce(
    (acc, item) => {
      acc[item.type] += 1;
      return acc;
    },
    { internal: 0, external: 0 },
  );
  const heatmap = Array.from({ length: 84 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (83 - index));
    const key = todayKey(date);
    return sessionsOnDate(reportState, key).length;
  });

  return {
    filter,
    reportState,
    rewardState,
    insights,
    quality,
    actions,
    hotspots,
    summary,
    projects,
    tags,
    days,
    maxCount,
    completedFocusSessionCount: completedSessions.length,
    estimateSummary,
    inaccurateTasks,
    projectDistribution,
    tagDistribution,
    maxDistribution,
    estimateDays,
    interruptions,
    heatmap,
  };
};
