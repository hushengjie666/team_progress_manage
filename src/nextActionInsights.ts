import { todayKey } from "./seed";
import type { AppState, NextAction } from "./types";
import {
  planForDate,
  unresolvedInterruptions,
} from "./domainQueries";
import { planPressure } from "./planningDomain";
import { focusQuality } from "./focusQualityInsight";

export const nextActions = (state: AppState, date = todayKey()): NextAction[] => {
  const plan = planForDate(state, date);
  const actions: NextAction[] = [];
  const pressure = plan ? planPressure(state, plan) : undefined;
  const unresolved = unresolvedInterruptions(state).length;
  const quality = focusQuality(state, date);
  if (!plan?.committedTaskIds.length) {
    actions.push({
      id: "commit_today",
      title: "先确定工作队列",
      detail: "从任务池里选 1-3 个最值得推进的任务，避免任务池变成压力源。",
      actionLabel: "去工作台",
      target: "workspace",
    });
  }
  if (pressure?.level === "overloaded") {
    actions.push({
      id: "reduce_overload",
      title: "今日计划已经超载",
      detail: `减少 ${pressure.overBy} 个番茄，或先拆分最大任务。`,
      actionLabel: "调整计划",
      target: "workspace",
    });
  }
  if (unresolved > 0) {
    actions.push({
      id: "clear_inbox",
      title: "清空中断收件箱",
      detail: `还有 ${unresolved} 条中断未处理，先转任务或标记已处理。`,
      actionLabel: "处理收件箱",
      target: "workspace",
    });
  }
  if (!state.activeTimer && plan?.committedTaskIds.length) {
    actions.push({
      id: "start_focus",
      title: "启动下一颗番茄",
      detail: "承诺已经有了，现在只需要选择一件事开始。",
      actionLabel: "去专注",
      target: "focus",
    });
  }
  if (!plan?.reviewedAt && (plan?.completedPomodoros ?? 0) > 0) {
    actions.push({
      id: "review_today",
      title: "补一条日终回顾",
      detail: "把今天的中断模式和明日注意事项记下来，明天计划会更准。",
      actionLabel: "写回顾",
      target: "workspace",
    });
  }
  if (quality.score < 55) {
    actions.push({
      id: "reduce_switching",
      title: "明天减少切换",
      detail: "今天专注质量偏低，建议把任务拆小并提前安排沟通窗口。",
      actionLabel: "去计划",
      target: "settings",
    });
  }
  return actions.slice(0, 4);
};
