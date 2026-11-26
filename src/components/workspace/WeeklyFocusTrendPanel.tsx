import { useEffect, useMemo, useState } from "react";
import { todayKey } from "../../seed";
import type { AppState } from "../../types";
import { weeklyFocusTrend } from "../../weeklyFocusTrend";

function duration(seconds: number) {
  return [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    .map((part, index) => index ? String(part).padStart(2, "0") : part).join(":");
}

export function WeeklyFocusTrendPanel({ state, workspaceId }: { state: AppState; workspaceId: string | null }) {
  const [day, setDay] = useState(() => todayKey());
  useEffect(() => {
    const update = () => setDay(todayKey());
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const timer = window.setTimeout(update, midnight.getTime() - Date.now());
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, [day]);

  const trend = useMemo(() => weeklyFocusTrend(state, workspaceId, day), [state, workspaceId, day]);
  const peak = Math.max(1, ...trend.days.map((item) => item.seconds));
  const heights = trend.days.map((item) => 72 - 60 * item.seconds / peak);

  return (
    <section className="band weekly-focus-trend" aria-labelledby="weekly-focus-title">
      <header>
        <h2 id="weekly-focus-title">最近 7 天投入时长</h2>
        {trend.hasHistory && <span>合计 <strong>{duration(trend.totalSeconds)}</strong></span>}
      </header>
      {trend.hasHistory ? (
        <>
          <svg width="100%" height="80" aria-hidden="true">
            <line x1="0" x2="100%" y1="72" y2="72" stroke="#c4d4ce" />
            <svg viewBox="0 0 14 80" preserveAspectRatio="none">
              <polyline points={heights.map((y, i) => `${2 * i + 1},${y}`).join(" ")}
                fill="none" stroke="currentColor" strokeWidth="2" vectorEffect="non-scaling-stroke" />
            </svg>
            {heights.map((y, i) => <circle key={i} cx={`${(i + 0.5) * 100 / 7}%`} cy={y} r="3.5" fill="currentColor" />)}
          </svg>
          <ol aria-label="每日投入时长">
            {trend.days.map((item) => (
              <li key={item.date} tabIndex={0} aria-label={`${item.date}，${Math.floor(item.seconds / 3600)}小时${Math.floor(item.seconds / 60) % 60}分${item.seconds % 60}秒`}>
                <time dateTime={item.date}>{item.date.slice(5).replace("-", "/")}</time>
                <b>{duration(item.seconds)}</b>
              </li>
            ))}
          </ol>
          <p>按本机日期统计，时长格式为时:分:秒。跨天按实际专注时段分摊，历史记录仅有累计暂停时长时，净时长计入结束日。</p>
        </>
      ) : <p>当前范围暂无已结束的个人工作会话。</p>}
    </section>
  );
}
