import type { ProjectMember, Task } from "./types";
import { clampTaskToWindow, taskScheduleDateRange } from "./scheduleCalendarRange";
export { addScheduleDays, dateFromScheduleKey, scheduleWindowStart, taskScheduleDateRange, type ScheduleDateRange } from "./scheduleCalendarRange";

export const SCHEDULE_WINDOW_DAYS = 42;

export const scheduleMemberName = (members: ProjectMember[], memberId?: string) => {
  if (!memberId) return "未分配";
  return members.find((member) => member.id === memberId)?.name ?? "已分配";
};

export type ScheduleItem = {
  task: Task;
  gridColumn: string;
  clippedStart: boolean;
  clippedEnd: boolean;
  visibleDays: number;
  lane: number;
};

export const buildScheduleItems = (tasks: Task[], windowStart: string, windowDays: number): ScheduleItem[] => {
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

export type ScheduleMonthGroup = {
  label: string;
  count: number;
};

export const buildScheduleMonthGroups = (days: string[]): ScheduleMonthGroup[] =>
  days.reduce<ScheduleMonthGroup[]>((groups, day) => {
    const label = `${Number(day.slice(5, 7))}月`;
    const last = groups[groups.length - 1];
    if (last?.label === label) last.count += 1;
    else groups.push({ label, count: 1 });
    return groups;
  }, []);

const visibleScheduleTasks = (tasks: Task[]) =>
  tasks
    .filter((task) => task.status !== "split" && task.status !== "archived")
    .sort((left, right) => {
      const leftDate = taskScheduleDateRange(left)?.start ?? "9999-12-31";
      const rightDate = taskScheduleDateRange(right)?.start ?? "9999-12-31";
      if (leftDate !== rightDate) return leftDate.localeCompare(rightDate);
      return left.sortOrder - right.sortOrder;
    });

export const splitScheduleTasks = (tasks: Task[]) => {
  const visibleTasks = visibleScheduleTasks(tasks);
  return {
    scheduledTasks: visibleTasks.filter((task) => Boolean(taskScheduleDateRange(task))),
    unscheduledTasks: visibleTasks.filter((task) => !taskScheduleDateRange(task)),
  };
};
