import { useMemo, useState } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { todayKey } from "../../seed";
import type { AppState, CalendarDaySummary } from "../../types";
import { buildCalendarDayDetailModel } from "./calendarDayDetailModel";
import { CalendarDayReviewSnapshot } from "./CalendarDayReviewSnapshot";
import { CalendarDayTimeline } from "./CalendarDayTimeline";

type CalendarDayDetailPanelProps = {
  state: AppState;
  selected?: CalendarDaySummary;
  openTask: (taskId: string) => void;
  scheduleTaskForDate: (date: string, taskId: string) => void;
};

export function CalendarDayDetailPanel({ state, selected, openTask, scheduleTaskForDate }: CalendarDayDetailPanelProps) {
  const [scheduleTaskId, setScheduleTaskId] = useState("");
  const detail = useMemo(() => buildCalendarDayDetailModel(state, selected), [state, selected]);

  return (
    <section className="band day-detail">
      <div className="section-title">
        <div>
          <p className="eyebrow">当日明细</p>
          <h2>{selected?.date ?? todayKey()} 详情</h2>
        </div>
        <CalendarDays size={20} />
      </div>
      <div className="metric-row compact-metrics">
        <MiniMetric label="完成番茄" value={`${selected?.completedPomodoros ?? 0}`} />
        <MiniMetric label="计划番茄" value={`${selected?.plannedPomodoros ?? 0}`} />
        <MiniMetric label="中断" value={`${selected?.interruptionCount ?? 0}`} />
        <MiniMetric label="作废" value={`${selected?.abortedPomodoros ?? 0}`} />
        {selected && <MiniMetric label="回顾状态" value={detail.selectedPlan?.reviewedAt ? "已回顾" : "未回顾"} />}
      </div>
      <CalendarDayReviewSnapshot selectedPlan={detail.selectedPlan} review={detail.review} reviewLabel={detail.reviewLabel} />
      <div className="day-task-list">
        {detail.selectedTasks.map((task) => (
          <button className="day-task-item" key={task.id} onClick={() => openTask(task.id)}>
            <strong>{task.title}</strong>
            <span>{task.project} · {task.estimatePomodoros} 番茄</span>
          </button>
        ))}
        {!detail.selectedTasks.length && <p className="empty">这一天还没有承诺任务。</p>}
      </div>
      <CalendarDayTimeline
        tasks={state.tasks}
        selectedSessions={detail.selectedSessions}
        selectedInterruptions={detail.selectedInterruptions}
        openTask={openTask}
      />
      {detail.overdueTasks.length > 0 && (
        <div className="warning-line">
          过期未完成：{detail.overdueTasks.map((task) => task.title).join("、")}
        </div>
      )}
      {detail.reminderTasks.length > 0 && (
        <div className="muted">
          提醒任务：{detail.reminderTasks.map((task) => task.title).join("、")}
        </div>
      )}
      <div className="schedule-box">
        <label>
          排入这一天
          <select value={scheduleTaskId} onChange={(event) => setScheduleTaskId(event.target.value)}>
            <option value="">选择任务</option>
            {detail.schedulableTasks.map((task) => (
              <option key={task.id} value={task.id}>{task.title}</option>
            ))}
          </select>
        </label>
        <button
          className="primary-button"
          disabled={!scheduleTaskId || !selected}
          onClick={() => {
            if (!selected || !scheduleTaskId) return;
            scheduleTaskForDate(selected.date, scheduleTaskId);
            setScheduleTaskId("");
          }}
        >
          加入计划
        </button>
      </div>
    </section>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <Clock3 size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
