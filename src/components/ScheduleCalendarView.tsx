import { CalendarDays, ChevronLeft, ChevronRight, Eye } from "lucide-react";
import { useMemo, useState } from "react";
import { labelPriority, labelTaskStage, taskStageOptions } from "../appModel";
import { todayKey } from "../seed";
import type { ProjectMember, Task } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 42;
const MIN_TASK_SPAN_DAYS = 3;
const MAX_TASK_SPAN_DAYS = 10;

const toDateKey = (value?: string) => value?.slice(0, 10);

const dateFromKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

const addDays = (key: string, days: number) => {
  const date = dateFromKey(key);
  date.setDate(date.getDate() + days);
  return todayKey(date);
};

const startOfWindow = (date: Date) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 7);
  return todayKey(copy);
};

const memberName = (members: ProjectMember[], memberId?: string) => {
  if (!memberId) return "未分配";
  return members.find((member) => member.id === memberId)?.name ?? "已分配";
};

const inferredSpanDays = (task: Task) => Math.max(MIN_TASK_SPAN_DAYS, Math.min(MAX_TASK_SPAN_DAYS, Math.ceil(task.estimatePomodoros / 4)));

const taskDateRange = (task: Task) => {
  const explicitStart = toDateKey(task.expectedStartAt);
  const explicitEnd = toDateKey(task.expectedFinishAt);
  const due = toDateKey(task.dueAt);
  const spanDays = inferredSpanDays(task);
  const start = explicitStart ?? (explicitEnd ? addDays(explicitEnd, 1 - spanDays) : due ? addDays(due, 1 - spanDays) : undefined);
  const end = explicitEnd ?? due ?? (explicitStart ? addDays(explicitStart, spanDays - 1) : undefined);
  if (!start || !end) return undefined;
  return start <= end ? { start, end } : { start: end, end: start };
};

const clampTaskToWindow = (task: Task, windowStart: string, windowDays: number) => {
  const range = taskDateRange(task);
  if (!range) return undefined;
  const startDate = dateFromKey(windowStart);
  const rangeStart = dateFromKey(range.start);
  const rangeEnd = dateFromKey(range.end);
  const startOffset = Math.floor((rangeStart.getTime() - startDate.getTime()) / DAY_MS);
  const endOffset = Math.floor((rangeEnd.getTime() - startDate.getTime()) / DAY_MS);
  const left = Math.max(0, startOffset);
  const right = Math.min(windowDays - 1, endOffset);
  if (right < 0 || left > windowDays - 1) return undefined;
  return {
    gridColumn: `${left + 1} / ${right + 2}`,
    clippedStart: startOffset < 0,
    clippedEnd: endOffset > windowDays - 1,
    startOffset: left,
    endOffset: right,
  };
};

type ScheduleItem = {
  task: Task;
  gridColumn: string;
  clippedStart: boolean;
  clippedEnd: boolean;
  visibleDays: number;
  lane: number;
};

const buildScheduleItems = (tasks: Task[], windowStart: string, windowDays: number): ScheduleItem[] => {
  const laneEnds: number[] = [];
  return tasks.reduce<ScheduleItem[]>((items, task) => {
    const placement = clampTaskToWindow(task, windowStart, windowDays);
    if (!placement) return items;
    const lane = laneEnds.findIndex((endOffset) => placement.startOffset > endOffset);
    const nextLane = lane === -1 ? laneEnds.length : lane;
    laneEnds[nextLane] = placement.endOffset;
    items.push({
      task,
      gridColumn: placement.gridColumn,
      clippedStart: placement.clippedStart,
      clippedEnd: placement.clippedEnd,
      visibleDays: placement.endOffset - placement.startOffset + 1,
      lane: nextLane,
    });
    return items;
  }, []);
};

export function ScheduleCalendarView(props: {
  tasks: Task[];
  members: ProjectMember[];
  activeTaskIds?: string[];
  todayTaskIds?: string[];
  title?: string;
  subtitle?: string;
  embedded?: boolean;
  openTask: (taskId: string) => void;
}) {
  const [cursor, setCursor] = useState(new Date());
  const windowStart = startOfWindow(cursor);
  const days = useMemo(() => Array.from({ length: WINDOW_DAYS }, (_, index) => addDays(windowStart, index)), [windowStart]);
  const activeTaskIds = useMemo(
    () => new Set(props.activeTaskIds ?? []),
    [props.activeTaskIds],
  );
  const todayTaskIds = new Set(props.todayTaskIds ?? []);
  const tasks = props.tasks
    .filter((task) => task.status !== "split" && task.status !== "archived")
    .sort((left, right) => {
      const leftDate = taskDateRange(left)?.start ?? "9999-12-31";
      const rightDate = taskDateRange(right)?.start ?? "9999-12-31";
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      return left.sortOrder - right.sortOrder;
    });
  const scheduledTasks = tasks.filter((task) => Boolean(taskDateRange(task)));
  const unscheduledTasks = tasks.filter((task) => !taskDateRange(task));
  const monthGroups = days.reduce<{ label: string; count: number }[]>((groups, day) => {
    const label = `${Number(day.slice(5, 7))}月`;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.count += 1;
    else groups.push({ label, count: 1 });
    return groups;
  }, []);

  return (
    <div className="schedule-calendar-layout">
      <section className={props.embedded ? "schedule-calendar-toolbar embedded" : "band schedule-calendar-toolbar"}>
        <div>
          <p className="eyebrow">排期日历</p>
          <h2>{props.title ?? "项目排期日历"}</h2>
          <p className="muted compact-copy">{props.subtitle ?? "按阶段查看任务排期、负责人、今日任务和运行状态。"}</p>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => setCursor((value) => dateFromKey(addDays(todayKey(value), -WINDOW_DAYS / 2)))}>
            <ChevronLeft size={16} />
            上一段
          </button>
          <button className="secondary-button" onClick={() => setCursor(new Date())}>
            <CalendarDays size={16} />
            今天
          </button>
          <button className="secondary-button" onClick={() => setCursor((value) => dateFromKey(addDays(todayKey(value), WINDOW_DAYS / 2)))}>
            下一段
            <ChevronRight size={16} />
          </button>
        </div>
      </section>

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

        {taskStageOptions.map((stage) => {
          const stageTasks = scheduledTasks.filter((task) => task.stage === stage.value);
          const scheduleItems = buildScheduleItems(stageTasks, windowStart, WINDOW_DAYS);
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
                      onClick={() => props.openTask(task.id)}
                      style={{ gridColumn: item.gridColumn, gridRow: `${item.lane + 1}` }}
                      title={`${task.title} · ${labelTaskStage[task.stage]}`}
                      type="button"
                    >
                      <span className="schedule-task-title">
                        {item.clippedStart && "…"}{task.title}{item.clippedEnd && "…"}
                      </span>
                      <span className="schedule-task-tags">
                        <i>{memberName(props.members, task.primaryExecutorMemberId)}</i>
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

      <section className="band unscheduled-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">未排期任务</p>
            <h2>还没有开始/完成日期</h2>
          </div>
          <span className="count-pill">{unscheduledTasks.length}</span>
        </div>
        <div className="unscheduled-task-grid">
          {unscheduledTasks.map((task) => (
            <button className="unscheduled-task-card" key={task.id} onClick={() => props.openTask(task.id)} type="button">
              <strong>{task.title}</strong>
              <span>{task.project} · {labelTaskStage[task.stage]} · {memberName(props.members, task.primaryExecutorMemberId)}</span>
            </button>
          ))}
          {unscheduledTasks.length === 0 && <p className="empty">所有任务都已经有排期。</p>}
        </div>
      </section>
    </div>
  );
}
