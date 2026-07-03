import { BarChart3, CalendarDays } from "lucide-react";
import type { ReportsViewModel } from "./reportPanelTypes";

export function ReportTrendPanel({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band trend-panel" id="focus-trend">
      <div className="section-title">
        <div>
          <p className="eyebrow">专注趋势</p>
          <h2>近 14 天专注趋势</h2>
          <p className="muted compact-copy">柱子越高，表示当天完成的番茄越多。</p>
        </div>
        <BarChart3 size={20} />
      </div>
      <div className="bar-chart">
        {report.days.map((day) => (
          <div className="bar-item" key={day.key}>
            <span style={{ height: `${Math.max(8, (day.count / report.maxCount) * 150)}px` }} />
            <small>{day.key.slice(5)}</small>
          </div>
        ))}
      </div>
    </section>
  );
}

export function ReportHeatmapPanel({ report }: { report: ReportsViewModel }) {
  return (
    <section className="band heatmap-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">年度热力</p>
          <h2>番茄热力图</h2>
          <p className="muted compact-copy">颜色越深，表示当天专注记录越密集。</p>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="heatmap">
        {report.heatmap.map((count, index) => (
          <span className={`heat heat-${Math.min(4, count)}`} key={`${index}-${count}`} />
        ))}
      </div>
    </section>
  );
}
