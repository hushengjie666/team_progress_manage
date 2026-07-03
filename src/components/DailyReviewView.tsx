import type React from "react";
import { Activity, Check, Square, Target } from "lucide-react";
import { abortedSessionsOnDate, dailyCompletionRate, sessionsForTask } from "../domain";
import { today } from "../appModel";
import type { AppState, DailyPlan } from "../types";

export function DailyReviewView(props: {
  state: AppState;
  todayPlan: DailyPlan;
  capacityHint: number;
  updateReview: (patch: Partial<DailyPlan["review"]>) => void;
  completeReview: () => void;
}) {
  const completionRate = dailyCompletionRate(props.state, props.todayPlan);
  const abortedToday = abortedSessionsOnDate(props.state, today()).length;
  const interruptionsToday = props.state.interruptions.filter((item) => item.createdAt.startsWith(today()));
  const lowEstimateTasks = props.state.tasks
    .map((task) => ({ task, actual: sessionsForTask(props.state, task.id).length || task.actualPomodoros }))
    .filter(({ task, actual }) => actual - task.estimatePomodoros >= 2)
    .slice(0, 3);

  return (
    <div className="content-grid workspace-grid daily-review-grid">
      <section className="band review-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">每日总结</p>
            <h2>日终回顾</h2>
          </div>
          <Check size={20} />
        </div>
        <div className="review-stats">
          <Metric icon={<Target size={17} />} label="承诺兑现" value={`${completionRate}%`} />
          <Metric icon={<Square size={17} />} label="作废番茄" value={`${abortedToday}`} />
          <Metric icon={<Activity size={17} />} label="今日中断" value={`${interruptionsToday.length}`} />
        </div>
        <div className="review-grid">
          <label>
            状态
            <select value={props.todayPlan.review.mood} onChange={(event) => props.updateReview({ mood: event.target.value as DailyPlan["review"]["mood"] })}>
              <option value="low">低能量</option>
              <option value="normal">稳定</option>
              <option value="good">不错</option>
              <option value="great">高光</option>
            </select>
          </label>
          <label>
            今日收获
            <textarea value={props.todayPlan.review.wins} onChange={(event) => props.updateReview({ wins: event.target.value })} />
          </label>
          <label>
            阻碍
            <textarea value={props.todayPlan.review.blockers} onChange={(event) => props.updateReview({ blockers: event.target.value })} />
          </label>
          <label>
            中断模式
            <textarea value={props.todayPlan.review.interruptionPattern} onChange={(event) => props.updateReview({ interruptionPattern: event.target.value })} />
          </label>
          <label>
            明日注意事项
            <textarea value={props.todayPlan.review.tomorrowFocus} onChange={(event) => props.updateReview({ tomorrowFocus: event.target.value })} />
          </label>
        </div>
        {lowEstimateTasks.length > 0 && (
          <div className="insight-list compact">
            {lowEstimateTasks.map(({ task, actual }) => (
              <article className="insight-item" key={task.id}>
                <strong>{task.title}</strong>
                <span>低估 {actual - task.estimatePomodoros} 个番茄，明天优先拆小。</span>
              </article>
            ))}
          </div>
        )}
        <div className="button-row">
          <button className="primary-button" onClick={props.completeReview}>
            <Check size={16} />
            完成回顾并生成明日建议
          </button>
        </div>
        <p className="muted">
          {props.todayPlan.reviewedAt
            ? `已于 ${new Date(props.todayPlan.reviewedAt).toLocaleTimeString()} 完成回顾，建议明日 ${props.todayPlan.suggestedCapacityPomodoros ?? props.capacityHint} 个番茄。`
            : "完成回顾后会更新连续天数、徽章和明日容量建议。"}
        </p>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric-card">
      <span>{icon}</span>
      <p>{label}</p>
      <strong>{value}</strong>
    </div>
  );
}
