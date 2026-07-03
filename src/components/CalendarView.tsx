import { Check, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarSummaries } from "../planning";
import { todayKey } from "../seed";
import type { AppState, CalendarViewMode, TaskTemplate } from "../types";
import { CalendarDayDetailPanel } from "./calendar/CalendarDayDetailPanel";
import { CalendarTemplatePanel } from "./calendar/CalendarTemplatePanel";

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return todayKey(copy);
};

const startOfMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

export function CalendarView(props: {
  state: AppState;
  mode: CalendarViewMode;
  setMode: (mode: CalendarViewMode) => void;
  instantiateTaskTemplate: (template: TaskTemplate) => void;
  saveTaskTemplate: (template: TaskTemplate) => void;
  deleteTaskTemplate: (templateId: string) => void;
  scheduleTaskForDate: (date: string, taskId: string) => void;
  openTask: (taskId: string) => void;
}) {
  const { state, mode, setMode, instantiateTaskTemplate, saveTaskTemplate, deleteTaskTemplate, scheduleTaskForDate, openTask } = props;
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const startDate = mode === "week" ? startOfWeek(cursor) : startOfMonth(cursor);
  const days = mode === "week" ? 7 : 42;
  const summaries = useMemo(() => calendarSummaries(state, startDate, days), [state, startDate, days]);
  const selected = summaries.find((item) => item.date === selectedDate) ?? summaries.find((item) => item.date === todayKey()) ?? summaries[0];

  const shiftCursor = (step: number) => {
    setCursor((value) => {
      const next = new Date(value);
      if (mode === "week") next.setDate(value.getDate() + step * 7);
      else next.setMonth(value.getMonth() + step);
      return next;
    });
  };

  return (
    <div className="calendar-layout">
      <section className="band calendar-toolbar">
        <div>
          <p className="eyebrow">历史日报</p>
          <h2>历史日报</h2>
          <p className="muted compact-copy">选择日期后查看当天计划、番茄记录、提醒和回顾。</p>
        </div>
        <div className="segmented">
          <button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>周</button>
          <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>月</button>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => shiftCursor(-1)}>上一段</button>
          <button className="secondary-button" onClick={() => setCursor(new Date())}>
            <RotateCcw size={15} />
            今天
          </button>
          <button className="secondary-button" onClick={() => shiftCursor(1)}>下一段</button>
        </div>
      </section>

      <section className={`band calendar-grid calendar-${mode}`}>
        {summaries.map((day) => (
          <button
            className={day.date === selected?.date ? "calendar-day selected" : "calendar-day"}
            key={day.date}
            onClick={() => setSelectedDate(day.date)}
          >
            <span>{day.date.slice(5)}</span>
            <strong>{day.completedPomodoros}/{Math.max(1, day.plannedPomodoros)}</strong>
            <small>{day.reviewed ? "已回顾" : day.interruptionCount ? `${day.interruptionCount} 中断` : "待推进"}</small>
            <div className="calendar-markers">
              {day.overdueTaskIds.length > 0 && <i className="danger-dot" />}
              {day.reminderTaskIds.length > 0 && <i className="accent-dot" />}
              {day.reviewed && <Check size={12} />}
            </div>
          </button>
        ))}
      </section>

      <div className="calendar-detail-grid">
        <CalendarDayDetailPanel
          state={state}
          selected={selected}
          openTask={openTask}
          scheduleTaskForDate={scheduleTaskForDate}
        />
        <CalendarTemplatePanel
          templates={state.taskTemplates}
          instantiateTaskTemplate={instantiateTaskTemplate}
          saveTaskTemplate={saveTaskTemplate}
          deleteTaskTemplate={deleteTaskTemplate}
        />
      </div>
    </div>
  );
}
