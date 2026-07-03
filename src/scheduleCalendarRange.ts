import { todayKey } from "./seed";
import type { Task } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const MIN_TASK_SPAN_DAYS = 3;
const MAX_TASK_SPAN_DAYS = 10;

const toDateKey = (value?: string) => value?.slice(0, 10);

export const dateFromScheduleKey = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const addScheduleDays = (key: string, days: number) => {
  const date = dateFromScheduleKey(key);
  date.setDate(date.getDate() + days);
  return todayKey(date);
};

export const scheduleWindowStart = (date: Date) => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - 7);
  return todayKey(copy);
};

const inferredSpanDays = (task: Task) => Math.max(MIN_TASK_SPAN_DAYS, Math.min(MAX_TASK_SPAN_DAYS, Math.ceil(task.estimatePomodoros / 4)));

export type ScheduleDateRange = {
  start: string;
  end: string;
};

export const taskScheduleDateRange = (task: Task): ScheduleDateRange | undefined => {
  const explicitStart = toDateKey(task.expectedStartAt);
  const explicitEnd = toDateKey(task.expectedFinishAt);
  const due = toDateKey(task.dueAt);
  const spanDays = inferredSpanDays(task);
  const start = explicitStart ?? (explicitEnd ? addScheduleDays(explicitEnd, 1 - spanDays) : due ? addScheduleDays(due, 1 - spanDays) : undefined);
  const end = explicitEnd ?? due ?? (explicitStart ? addScheduleDays(explicitStart, spanDays - 1) : undefined);
  if (!start || !end) return undefined;
  return start <= end ? { start, end } : { start: end, end: start };
};

export type SchedulePlacement = {
  gridColumn: string;
  clippedStart: boolean;
  clippedEnd: boolean;
  startOffset: number;
  endOffset: number;
};

export const clampTaskToWindow = (task: Task, windowStart: string, windowDays: number): SchedulePlacement | undefined => {
  const range = taskScheduleDateRange(task);
  if (!range) return undefined;
  const startDate = dateFromScheduleKey(windowStart);
  const rangeStart = dateFromScheduleKey(range.start);
  const rangeEnd = dateFromScheduleKey(range.end);
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
