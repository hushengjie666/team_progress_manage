import { useMemo, useState } from "react";
import { addScheduleDays, buildScheduleMonthGroups, scheduleWindowStart, SCHEDULE_WINDOW_DAYS, splitScheduleTasks } from "../scheduleCalendar";
import type { ProjectMember, Task, TaskStageMode } from "../types";
import { ScheduleCalendarToolbar } from "./scheduleCalendar/ScheduleCalendarToolbar";
import { ScheduleTimelineBoard } from "./scheduleCalendar/ScheduleTimelineBoard";
import { UnscheduledTaskPanel } from "./scheduleCalendar/UnscheduledTaskPanel";

type ScheduleCalendarViewProps = {
  tasks: Task[];
  members: ProjectMember[];
  activeTaskIds?: string[];
  todayTaskIds?: string[];
  title?: string;
  subtitle?: string;
  taskStageMode?: TaskStageMode;
  embedded?: boolean;
  openTask: (taskId: string) => void;
};

export function ScheduleCalendarView(props: ScheduleCalendarViewProps) {
  const [cursor, setCursor] = useState(new Date());
  const windowStart = scheduleWindowStart(cursor);
  const days = useMemo(() => Array.from({ length: SCHEDULE_WINDOW_DAYS }, (_, index) => addScheduleDays(windowStart, index)), [windowStart]);
  const activeTaskIds = useMemo(
    () => new Set(props.activeTaskIds ?? []),
    [props.activeTaskIds],
  );
  const todayTaskIds = useMemo(
    () => new Set(props.todayTaskIds ?? []),
    [props.todayTaskIds],
  );
  const { scheduledTasks, unscheduledTasks } = useMemo(() => splitScheduleTasks(props.tasks), [props.tasks]);
  const monthGroups = useMemo(() => buildScheduleMonthGroups(days), [days]);

  return (
    <div className="schedule-calendar-layout">
      <ScheduleCalendarToolbar
        embedded={props.embedded}
        title={props.title}
        subtitle={props.subtitle}
        setCursor={setCursor}
      />
      <ScheduleTimelineBoard
        days={days}
        monthGroups={monthGroups}
        scheduledTasks={scheduledTasks}
        windowStart={windowStart}
        activeTaskIds={activeTaskIds}
        todayTaskIds={todayTaskIds}
        taskStageMode={props.taskStageMode}
        members={props.members}
        openTask={props.openTask}
      />
      <UnscheduledTaskPanel
        tasks={unscheduledTasks}
        members={props.members}
        openTask={props.openTask}
      />
    </div>
  );
}
