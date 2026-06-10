import type React from "react";
import { Activity, AlarmClock, BarChart3, CalendarDays, Clock3, SlidersHorizontal, Sparkles, Trophy } from "lucide-react";
import { buildInsights, completedFocusSessions, deriveRewardState, estimateDeltaLabel, focusQuality, interruptionHotspots, nextActions, sessionsOnDate } from "../domain";
import { modeLabel, type Tab } from "../appModel";
import { filteredStateForReport, reviewSummary } from "../planning";
import { todayKey } from "../seed";
import type { AppState, ReportFilter } from "../types";

export function ReportsView({
  state,
  onNavigate,
  updateReportFilter,
  onOpenTask,
  onFilterProject,
  onFilterTag,
}: {
  state: AppState;
  onNavigate: (tab: Tab) => void;
  updateReportFilter: (filter: ReportFilter) => void;
  onOpenTask: (taskId: string) => void;
  onFilterProject?: (project: string) => void;
  onFilterTag?: (tag: string) => void;
}) {
  const filter = state.settings.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" };
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
  const projectDistribution = Array.from(
    completedFocusSessions(reportState).reduce((map, session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      const key = task?.project ?? "无项目";
      map.set(key, (map.get(key) ?? 0) + 1);
      return map;
    }, new Map<string, number>()),
  ).sort((left, right) => right[1] - left[1]);
  const tagDistribution = Array.from(
    completedFocusSessions(reportState).reduce((map, session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      const tags = task?.tags.length ? task.tags : ["无标签"];
      for (const tag of tags) map.set(tag, (map.get(tag) ?? 0) + 1);
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

  return (
    <div className="reports-layout">
      <section className="band metric-row">
        <Metric icon={<Trophy size={19} />} label="连续天数" value={`${rewardState.streak} 天`} />
        <Metric icon={<Clock3 size={19} />} label="筛选番茄" value={`${completedFocusSessions(reportState).length} 个`} />
        <Metric icon={<AlarmClock size={19} />} label="估算偏差" value={estimateSummary} />
        <Metric icon={<Activity size={19} />} label="中断 内/外" value={`${interruptions.internal}/${interruptions.external}`} />
      </section>

      <section className="band report-filter-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Review Filter</p>
            <h2>{summary.rangeLabel}复盘</h2>
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
              {state.tasks.map((task) => (
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

      <section className="band reward-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Reward Loop</p>
            <h2>自律激励</h2>
          </div>
          <Trophy size={20} />
        </div>
        <div className="reward-grid">
          <div className="quality-card">
            <strong>{quality.score}</strong>
            <span>{quality.label}</span>
            <p>{quality.detail}</p>
          </div>
          <div className="badge-wall">
            {rewardState.badges.slice(0, 10).map((badge) => (
              <span className="badge-chip" key={badge}>{badge}</span>
            ))}
            {rewardState.badges.length === 0 && <p className="empty">完成番茄和日终回顾后会点亮徽章。</p>}
          </div>
        </div>
      </section>

      <section className="band next-action-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Next Actions</p>
            <h2>下一步建议</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="next-action-list">
          {actions.map((action) => (
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
          {actions.length === 0 && <p className="empty">今天的闭环很完整，可以保持当前节奏。</p>}
        </div>
      </section>

      <section className="band insight-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Actionable Insights</p>
            <h2>可操作洞察</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="insight-list">
          {insights.slice(0, 3).map((insight) => (
            <article className={`insight-item insight-${insight.severity}`} key={insight.id}>
              <strong>{insight.title}</strong>
              <span>{insight.detail}</span>
              <button
                className="link-button"
                onClick={() => {
                  const targetId =
                    insight.kind === "estimate"
                      ? "estimate-feedback"
                      : insight.kind === "interruption" || insight.kind === "strict"
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

      <section className="band trend-panel" id="focus-trend">
        <div className="section-title">
          <div>
            <p className="eyebrow">Focus Trend</p>
            <h2>近 14 天专注趋势</h2>
          </div>
          <BarChart3 size={20} />
        </div>
        <div className="bar-chart">
          {days.map((day) => (
            <div className="bar-item" key={day.key}>
              <span style={{ height: `${Math.max(8, (day.count / maxCount) * 150)}px` }} />
              <small>{day.key.slice(5)}</small>
            </div>
          ))}
        </div>
      </section>

      <section className="band heatmap-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Annual Wall</p>
            <h2>番茄热力图</h2>
          </div>
          <CalendarDays size={20} />
        </div>
        <div className="heatmap">
          {heatmap.map((count, index) => (
            <span className={`heat heat-${Math.min(4, count)}`} key={`${index}-${count}`} />
          ))}
        </div>
      </section>

      <section className="band estimate-panel" id="estimate-feedback">
        <div className="section-title">
          <div>
            <p className="eyebrow">Estimate Feedback</p>
            <h2>估算反馈</h2>
          </div>
          <AlarmClock size={20} />
        </div>
        <div className="estimate-bars">
          {estimateDays.map((day) => (
            <div className="estimate-day" key={day.key}>
              <span className={day.delta > 0 ? "over" : day.delta < 0 ? "under" : ""} style={{ height: `${Math.max(8, Math.abs(day.delta) * 22)}px` }} />
              <small>{day.key.slice(5)}</small>
            </div>
          ))}
        </div>
        <div className="insight-list">
          {inaccurateTasks.map(({ task, actual }) => (
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
          {!inaccurateTasks.length && <p className="empty">完成任务后会出现估算反馈。</p>}
        </div>
      </section>

      <section className="band hotspot-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Interruption Hotspots</p>
            <h2>中断高发时段</h2>
          </div>
          <Activity size={20} />
        </div>
        <div className="hotspot-list">
          {hotspots.map((hotspot) => (
            <article className="hotspot-item" key={hotspot.hour}>
              <strong>{hotspot.label}</strong>
              <div>
                <span style={{ width: `${Math.min(100, hotspot.count * 18)}%` }} />
              </div>
              <small>{hotspot.count} 次 · 内 {hotspot.internal} / 外 {hotspot.external}</small>
            </article>
          ))}
          {hotspots.length === 0 && <p className="empty">记录中断后会分析高发时段。</p>}
        </div>
      </section>

      <section className="band distribution-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Distribution</p>
            <h2>项目与标签分布</h2>
          </div>
          <SlidersHorizontal size={20} />
        </div>
        <div className="distribution-grid">
          <DistributionList
            title="项目"
            items={projectDistribution}
            max={maxDistribution}
            onItemSelect={(project) => onFilterProject?.(project)}
          />
          <DistributionList
            title="标签"
            items={tagDistribution}
            max={maxDistribution}
            onItemSelect={(tag) => onFilterTag?.(tag)}
          />
        </div>
      </section>

      <section className="band timeline-panel" id="focus-timeline">
        <div className="section-title">
          <div>
            <p className="eyebrow">Timeline</p>
            <h2>专注时间线</h2>
          </div>
          <Clock3 size={20} />
        </div>
        <div className="timeline">
          {reportState.focusSessions.slice(0, 12).map((session) => {
            const task = state.tasks.find((item) => item.id === session.taskId);
            return (
              <article className="timeline-item" key={session.id}>
                <span />
                <div>
                  <strong>{task?.title ?? modeLabel[session.mode]}</strong>
                  <p>
                    {new Date(session.startedAt).toLocaleString()} · {session.outcome ?? "进行中"} · 内/外中断{" "}
                    {session.interruptionCounts.internal}/{session.interruptionCounts.external}
                  </p>
                  {session.taskId && (
                    <button className="link-button" onClick={() => onOpenTask(session.taskId!)}>
                      查看任务
                    </button>
                  )}
                </div>
              </article>
            );
          })}
          {!reportState.focusSessions.length && <p className="empty">完成番茄后会出现时间线。</p>}
        </div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function DistributionList({
  title,
  items,
  max,
  onItemSelect,
}: {
  title: string;
  items: [string, number][];
  max: number;
  onItemSelect?: (name: string) => void;
}) {
  return (
    <div className="distribution-list">
      <strong>{title}</strong>
      {items.length === 0 && <p className="empty">暂无数据</p>}
      {items.map(([name, count]) => {
        const content = (
          <>
            <span>{name}</span>
            <div>
              <i style={{ width: `${Math.max(6, (count / max) * 100)}%` }} />
            </div>
            <small>{count}</small>
          </>
        );
        if (onItemSelect) {
          return (
            <button
              className="distribution-row distribution-row-button"
              key={name}
              onClick={() => onItemSelect(name)}
              type="button"
              title={`按 ${title} 筛选「${name}」`}
            >
              {content}
            </button>
          );
        }
        return (
          <div className="distribution-row" key={name}>
            {content}
          </div>
        );
      })}
    </div>
  );
}
