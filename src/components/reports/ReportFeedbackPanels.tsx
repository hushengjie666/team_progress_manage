import { Activity, AlarmClock } from "lucide-react";
import { estimateDeltaLabel } from "../../domain";
import type { ReportsViewModel } from "./reportPanelTypes";

export function ReportEstimatePanel({
  report,
  onOpenTask,
}: {
  report: ReportsViewModel;
  onOpenTask: (taskId: string) => void;
}) {
  return (
    <section className="band estimate-panel" id="estimate-feedback">
      <div className="section-title">
        <div>
          <p className="eyebrow">估算反馈</p>
          <h2>估算反馈</h2>
          <p className="muted compact-copy">高于基线代表低估，低于基线代表高估。</p>
        </div>
        <AlarmClock size={20} />
      </div>
      <div className="estimate-bars">
        {report.estimateDays.map((day) => (
          <div className="estimate-day" key={day.key}>
            <span className={day.delta > 0 ? "over" : day.delta < 0 ? "under" : ""} style={{ height: `${Math.max(8, Math.abs(day.delta) * 22)}px` }} />
            <small>{day.key.slice(5)}</small>
          </div>
        ))}
      </div>
      <div className="insight-list">
        {report.inaccurateTasks.map(({ task, actual }) => (
          <article className="insight-item" key={task.id}>
            <strong>{task.title}</strong>
            <span>
              估 {task.estimatePomodoros} / 实 {actual} / {estimateDeltaLabel(task.estimatePomodoros, actual)}
            </span>
            <button className="link-button" onClick={() => onOpenTask(task.id)}>
              打开任务
            </button>
          </article>
        ))}
        {!report.inaccurateTasks.length && <p className="empty">完成任务后会出现估算反馈。</p>}
      </div>
    </section>
  );
}

export function ReportHotspotPanel({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band hotspot-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">中断分析</p>
          <h2>中断高发时段</h2>
          <p className="muted compact-copy">优先处理次数最高的时段和来源。</p>
        </div>
        <Activity size={20} />
      </div>
      <div className="hotspot-list">
        {report.hotspots.map((hotspot) => (
          <article className="hotspot-item" key={hotspot.hour}>
            <strong>{hotspot.label}</strong>
            <div>
              <span style={{ width: `${Math.min(100, hotspot.count * 18)}%` }} />
            </div>
            <small>{hotspot.count} 次 · 内 {hotspot.internal} / 外 {hotspot.external}</small>
          </article>
        ))}
        {report.hotspots.length === 0 && <p className="empty">记录中断后会分析高发时段。</p>}
      </div>
    </section>
  );
}
