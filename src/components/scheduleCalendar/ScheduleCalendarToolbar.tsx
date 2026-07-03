import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import type { Dispatch, SetStateAction } from "react";
import { addScheduleDays, dateFromScheduleKey, SCHEDULE_WINDOW_DAYS } from "../../scheduleCalendar";
import { todayKey } from "../../seed";

type ScheduleCalendarToolbarProps = {
  embedded?: boolean;
  title?: string;
  subtitle?: string;
  setCursor: Dispatch<SetStateAction<Date>>;
};

export function ScheduleCalendarToolbar({
  embedded,
  title,
  subtitle,
  setCursor,
}: ScheduleCalendarToolbarProps) {
  const moveWindow = (days: number) => {
    setCursor((value) => dateFromScheduleKey(addScheduleDays(todayKey(value), days)));
  };

  return (
    <section className={embedded ? "schedule-calendar-toolbar embedded" : "band schedule-calendar-toolbar"}>
      <div>
        <p className="eyebrow">排期日历</p>
        <h2>{title ?? "项目排期日历"}</h2>
        <p className="muted compact-copy">{subtitle ?? "按阶段查看任务排期、负责人、今日任务和运行状态。"}</p>
      </div>
      <div className="button-row">
        <button className="secondary-button" onClick={() => moveWindow(-SCHEDULE_WINDOW_DAYS / 2)}>
          <ChevronLeft size={16} />
          上一段
        </button>
        <button className="secondary-button" onClick={() => setCursor(new Date())}>
          <CalendarDays size={16} />
          今天
        </button>
        <button className="secondary-button" onClick={() => moveWindow(SCHEDULE_WINDOW_DAYS / 2)}>
          下一段
          <ChevronRight size={16} />
        </button>
      </div>
    </section>
  );
}
