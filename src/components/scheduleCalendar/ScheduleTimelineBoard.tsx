import { Eye } from "lucide-react";
import { labelPriority, labelTaskStage, taskStageOptionsForMode } from "../../appModel";
import { buildScheduleItems, scheduleMemberName, SCHEDULE_WINDOW_DAYS, type ScheduleMonthGroup } from "../../scheduleCalendar";
import { todayKey } from "../../seed";
import type { ProjectMember, Task, TaskStageMode } from "../../types";

type ScheduleTimelineBoardProps = {
  days: string[];
  monthGroups: ScheduleMonthGroup[];
  scheduledTasks: Task[];
  windowStart: string;
  activeTaskIds: ReadonlySet<string>;
  todayTaskIds: ReadonlySet<string>;
  taskStageMode?: TaskStageMode;
  members: ProjectMember[];
  openTask: (taskId: string) => void;
};

export function ScheduleTimelineBoard({
  days,
  monthGroups,
  scheduledTasks,
  windowStart,
  activeTaskIds,
  todayTaskIds,
  taskStageMode,
  members,
  openTask,
}: ScheduleTimelineBoardProps) {
  return (
    <section className="band schedule-board" aria-label="项目排期时间轴">
      <div className="schedule-left-spacer" />
      <div className="schedule-month-row">
        {monthGroups.map((group, index) => {
          const start = monthGroups.slice(0, index).reduce((sum, item) => sum + item.count, 0) + 1;
          return (
            <span key={`${group.label}-${index}`} style={{ gridColumn: `${start} / span ${group.count}` }}>
              {group.label}
            </span>
          );
        })}
      </div>
      <div className="schedule-left-spacer subtle">阶段</div>
      <div className="schedule-day-row">
        {days.map((day) => (
          <span className={day === todayKey() ? "today" : ""} key={day}>{day.slice(8)}</span>
        ))}
      </div>

      {taskStageOptionsForMode(taskStageMode ?? "software").map((stage) => {
        const stageTasks = scheduledTasks.filter((task) => task.stage === stage.value);
        const scheduleItems = buildScheduleItems(stageTasks, windowStart, SCHEDULE_WINDOW_DAYS);
        const laneCount = Math.max(1, scheduleItems.reduce((max, item) => Math.max(max, item.lane + 1), 0));
        return (
          <div className="schedule-stage-row" key={stage.value} style={{ minHeight: `${Math.max(72, laneCount * 42 + 20)}px` }}>
            <div className="schedule-stage-label">
              <strong>{stage.label}</strong>
              <span>{stageTasks.length}</span>
            </div>
            <div className="schedule-stage-track" style={{ gridTemplateRows: `repeat(${laneCount}, 34px)` }}>
              <div className="schedule-grid-lines" />
              {scheduleItems.length === 0 && <span className="schedule-empty">暂无排期</span>}
              {scheduleItems.map((item) => {
                const { task } = item;
                const isToday = todayTaskIds.has(task.id);
                const isActive = activeTaskIds.has(task.id);
                return (
                  <button
                    className={[
                      "schedule-task-bar",
                      item.visibleDays <= 6 ? "compact" : "",
                      isToday ? "today" : "",
                      isActive ? "active" : "",
                      task.status === "pending_review" ? "review" : "",
                    ].filter(Boolean).join(" ")}
                    key={task.id}
                    onClick={() => openTask(task.id)}
                    style={{ gridColumn: item.gridColumn, gridRow: `${item.lane + 1}` }}
                    title={`${task.title} · ${labelTaskStage[task.stage]}`}
                    type="button"
                  >
                    <span className="schedule-task-title">
                      {item.clippedStart && "…"}{task.title}{item.clippedEnd && "…"}
                    </span>
                    <span className="schedule-task-tags">
                      <i>{scheduleMemberName(members, task.primaryExecutorMemberId)}</i>
                      <i>{labelPriority[task.priority]}</i>
                      {isToday && <i className="today">今日</i>}
                      {isActive && <i className="active">执行中</i>}
                      {task.status === "pending_review" && <i className="review">待验收</i>}
                      <Eye size={12} />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </section>
  );
}
