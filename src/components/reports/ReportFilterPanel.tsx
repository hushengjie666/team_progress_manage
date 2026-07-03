import { Activity, AlarmClock, Clock3, SlidersHorizontal, Trophy } from "lucide-react";
import { estimateDeltaLabel } from "../../domain";
import type { ReportFilter, ReviewSummary, Task } from "../../types";
import { Metric } from "./ReportPrimitives";

export function ReportFilterPanel({
  filter,
  summary,
  projects,
  tags,
  tasks,
  updateReportFilter,
}: {
  filter: ReportFilter;
  summary: ReviewSummary;
  projects: string[];
  tags: string[];
  tasks: Task[];
  updateReportFilter: (filter: ReportFilter) => void;
}) {
  return (
    <section className="band report-filter-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">复盘筛选</p>
          <h2>{summary.rangeLabel}复盘</h2>
          <p className="muted compact-copy">先选范围，再看兑现率、估算偏差、中断和下一步建议。</p>
        </div>
        <SlidersHorizontal size={20} />
      </div>
      <div className="filter-grid">
        <label>
          时间范围
          <select value={filter.range} onChange={(event) => updateReportFilter({ ...filter, range: event.target.value as ReportFilter["range"] })}>
            <option value="7d">近 7 天</option>
            <option value="30d">近 30 天</option>
            <option value="quarter">季度</option>
            <option value="year">今年</option>
          </select>
        </label>
        <label>
          项目
          <select value={filter.project} onChange={(event) => updateReportFilter({ ...filter, project: event.target.value })}>
            <option value="all">全部项目</option>
            {projects.map((project) => (
              <option key={project} value={project}>{project}</option>
            ))}
          </select>
        </label>
        <label>
          标签
          <select value={filter.tag} onChange={(event) => updateReportFilter({ ...filter, tag: event.target.value })}>
            <option value="all">全部标签</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </label>
        <label>
          任务
          <select value={filter.taskId} onChange={(event) => updateReportFilter({ ...filter, taskId: event.target.value })}>
            <option value="all">全部任务</option>
            {tasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="review-summary-grid">
        <Metric icon={<Clock3 size={17} />} label="完成" value={`${summary.completedPomodoros} 个`} />
        <Metric icon={<Trophy size={17} />} label="兑现率" value={`${summary.commitmentRate}%`} />
        <Metric icon={<AlarmClock size={17} />} label="估算" value={estimateDeltaLabel(0, summary.estimateDelta)} />
        <Metric icon={<Activity size={17} />} label="中断" value={`${summary.interruptionCount}`} />
      </div>
      <p className="muted">
        {summary.capacityAdvice}
        {summary.topInterruptionHour ? ` 高频中断出现在 ${summary.topInterruptionHour}。` : ""}
        {summary.underestimatedProjects.length ? ` 容易低估：${summary.underestimatedProjects.join("、")}。` : ""}
      </p>
    </section>
  );
}
