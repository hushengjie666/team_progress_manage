import { Activity, AlarmClock, Clock3, Sparkles, Trophy } from "lucide-react";
import type { Tab } from "../../appModel";
import { Metric } from "./ReportPrimitives";
import type { ReportsViewModel } from "./reportPanelTypes";

export function ReportMetricSummary({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band metric-row">
      <Metric icon={<Trophy size={19} />} label="连续天数" value={`${report.rewardState.streak} 天`} />
      <Metric icon={<Clock3 size={19} />} label="筛选番茄" value={`${report.completedFocusSessionCount} 个`} />
      <Metric icon={<AlarmClock size={19} />} label="估算偏差" value={report.estimateSummary} />
      <Metric icon={<Activity size={19} />} label="中断 内/外" value={`${report.interruptions.internal}/${report.interruptions.external}`} />
    </section>
  );
}

export function ReportRewardPanel({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band reward-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">激励反馈</p>
          <h2>自律激励</h2>
        </div>
        <Trophy size={20} />
      </div>
      <div className="reward-grid">
        <div className="quality-card">
          <strong>{report.quality.score}</strong>
          <span>{report.quality.label}</span>
          <p>{report.quality.detail}</p>
        </div>
        <div className="badge-wall">
          {report.rewardState.badges.slice(0, 10).map((badge) => (
            <span className="badge-chip" key={badge}>{badge}</span>
          ))}
          {report.rewardState.badges.length === 0 && <p className="empty">完成番茄和日终回顾后会点亮徽章。</p>}
        </div>
      </div>
    </section>
  );
}

export function ReportNextActionPanel({
  report,
  onNavigate,
}: {
  report: ReportsViewModel;
  onNavigate: (tab: Tab) => void;
}) {
  return (
    <section className="band next-action-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">下一步</p>
          <h2>下一步建议</h2>
        </div>
        <Sparkles size={20} />
      </div>
      <div className="next-action-list">
        {report.actions.map((action) => (
          <article className="next-action-item" key={action.id}>
            <div>
              <strong>{action.title}</strong>
              <span>{action.detail}</span>
            </div>
            <button className="small-button" onClick={() => onNavigate(action.target)}>
              {action.actionLabel}
            </button>
          </article>
        ))}
        {report.actions.length === 0 && <p className="empty">今天的闭环很完整，可以保持当前节奏。</p>}
      </div>
    </section>
  );
}

export function ReportInsightPanel({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band insight-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">可操作洞察</p>
          <h2>优先处理的问题</h2>
        </div>
        <Sparkles size={20} />
      </div>
      <div className="insight-list">
        {report.insights.slice(0, 3).map((insight) => (
          <article className={`insight-item insight-${insight.severity}`} key={insight.id}>
            <strong>{insight.title}</strong>
            <span>{insight.detail}</span>
            <button
              className="link-button"
              onClick={() => {
                const targetId =
                  insight.kind === "estimate"
                    ? "estimate-feedback"
                    : insight.kind === "interruption"
                      ? "focus-timeline"
                      : "focus-trend";
                document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              查看相关记录
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
