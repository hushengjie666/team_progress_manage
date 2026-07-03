import { todayKey } from "./seed";
import type { AppState, FocusQuality } from "./types";
import {
  abortedSessionsOnDate,
  interruptionsOnDate,
  planForDate,
  sessionsOnDate,
} from "./domainQueries";

export const focusQuality = (state: AppState, date = todayKey()): FocusQuality => {
  const completed = sessionsOnDate(state, date).length;
  const aborted = abortedSessionsOnDate(state, date).length;
  const interruptions = interruptionsOnDate(state, date).length;
  const plan = planForDate(state, date);
  const goal = Math.max(1, state.rewardState.dailyGoal);
  const goalScore = Math.min(45, Math.round((completed / goal) * 45));
  const interruptionPenalty = Math.min(30, interruptions * 5);
  const abortPenalty = Math.min(25, aborted * 8);
  const reviewBonus = plan?.reviewedAt ? 10 : 0;
  const score = Math.max(0, Math.min(100, 45 + goalScore + reviewBonus - interruptionPenalty - abortPenalty));
  const label = score >= 85 ? "高质量专注日" : score >= 65 ? "稳定推进" : score >= 45 ? "需要降噪" : "节奏偏乱";
  const detail =
    score >= 65
      ? `完成 ${completed} 个番茄，中断 ${interruptions} 次，节奏可以延续。`
      : `完成 ${completed} 个番茄，中断 ${interruptions} 次，建议明天减少承诺并提前屏蔽高频分心源。`;
  return { score, label, detail };
};
