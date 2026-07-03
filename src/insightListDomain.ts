import { todayKey } from "./seed";
import type { AppState, InsightItem } from "./types";
import {
  dailyCompletionRate,
  estimateDeltaLabel,
  interruptionsOnDate,
  planForDate,
  sessionsForTask,
} from "./domainQueries";
import { suggestedCapacity } from "./planningDomain";
import { interruptionHotspots } from "./interruptionInsights";

export const buildInsights = (state: AppState, date = todayKey()): InsightItem[] => {
  const plan = planForDate(state, date);
  const insights: InsightItem[] = [];
  const capacity = suggestedCapacity(state, date);
  insights.push({
    id: "capacity",
    kind: "capacity",
    title: "明日容量建议",
    detail: `建议承诺 ${capacity} 个番茄，基于近 7 天完成量和今日中断修正。`,
    severity: "info",
  });

  if (plan) {
    const rate = dailyCompletionRate(state, plan);
    insights.push({
      id: "commitment",
      kind: "commitment",
      title: "工作队列完成率",
      detail: `工作队列完成度约 ${rate}%。${rate < 60 ? "明天建议减少一到两个番茄容量。" : "节奏稳定，可以维持当前容量。"}`,
      severity: rate < 60 ? "warning" : "success",
    });
  }

  const underEstimated = [...state.tasks]
    .map((task) => {
      const actual = sessionsForTask(state, task.id).length || task.actualPomodoros;
      return { task, delta: actual - task.estimatePomodoros };
    })
    .filter((item) => item.delta >= 2)
    .sort((left, right) => right.delta - left.delta)[0];
  if (underEstimated) {
    insights.push({
      id: "estimate",
      kind: "estimate",
      title: "低估任务类型",
      detail: `「${underEstimated.task.title}」${estimateDeltaLabel(underEstimated.task.estimatePomodoros, underEstimated.task.estimatePomodoros + underEstimated.delta)}，同类任务明天先拆小。`,
      severity: "warning",
    });
  }

  const interruptions = interruptionsOnDate(state, date);
  if (interruptions.length > 0) {
    const internal = interruptions.filter((item) => item.type === "internal").length;
    insights.push({
      id: "interruption",
      kind: "interruption",
      title: "中断模式",
      detail: `今日记录 ${interruptions.length} 次中断，其中内部中断 ${internal} 次。`,
      severity: interruptions.length >= 4 ? "warning" : "info",
    });
  }

  const hotspots = interruptionHotspots(state, 1);
  if (hotspots.length > 0 && hotspots[0].count >= 2) {
    insights.push({
      id: "rhythm",
      kind: "rhythm",
      title: "中断高发时段",
      detail: `${hotspots[0].label} 中断最多，共 ${hotspots[0].count} 次，建议这个时段安排浅任务或减少上下文切换。`,
      severity: "warning",
    });
  }

  return insights;
};
