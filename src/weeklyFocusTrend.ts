import { accessibleProjectIdsForCurrentUser } from "./accessControl";
import { projectMemberIdentityIds } from "./memberIdentity";
import { todayKey } from "./seed";
import type { AppState, ExecutionSignal, WorkSession } from "./types";
import { projectIdsForWorkspace } from "./workspaceScope";

type Interval = [start: number, end: number];

function recordedFocusIntervals(session: WorkSession, signals: ExecutionSignal[], start: number, end: number): Interval[] | undefined {
  const events = signals.map(({ type, createdAt }) => ({ type, time: Date.parse(createdAt) }))
    .filter(({ time }) => time >= start && time <= end)
    .sort((a, b) => a.time - b.time);
  const hasTransitions = events.some(({ type }) => type === "work_paused" || type === "work_resumed" || type === "work_reset");
  if (!hasTransitions && !(events.some(({ type, time }) => type === "work_started" && time === start) &&
      events.some(({ type, time }) => type === "work_ended" && time === end))) return;
  let running = true;
  let since = start;
  let resumedPauseMs = 0;
  let resumes = 0;
  const intervals: Interval[] = [];
  for (const event of events) {
    // The session itself supplies both boundaries when only pause/resume events were synced.
    if (event.type === "work_started" && event.time === start) continue;
    if (event.type === "work_ended" && event.time === end) continue;
    if (event.type === "work_reset" && event.time === start) {
      running = false;
      continue;
    }
    if (event.type === "work_paused" && running) {
      intervals.push([since, event.time]);
      running = false;
    } else if (event.type === "work_resumed" && !running) {
      resumedPauseMs += event.time - since;
      resumes++;
      running = true;
    } else {
      return;
    }
    since = event.time;
  }
  // Persisted pause counters use whole seconds per resume. A larger deficit means events are missing.
  if (session.totalPausedSeconds * 1000 > resumedPauseMs + resumes * 1000) return;
  if (running) {
    const pausedAt = Date.parse(session.pausedAt ?? "");
    intervals.push([since, pausedAt >= since && pausedAt <= end ? pausedAt : end]);
  }
  return intervals;
}

export function weeklyFocusTrend(state: AppState, workspaceId: string | null, localDay: string) {
  const midnight = new Date(localDay + "T00:00:00");
  const boundaries = Array.from({ length: 8 }, (_, index) => {
    const date = new Date(midnight);
    date.setDate(date.getDate() - 6 + index);
    return date.getTime();
  });
  const milliseconds = Array<number>(7).fill(0);
  const account = state.auth.account;
  const accessible = accessibleProjectIdsForCurrentUser(state);
  const scoped = projectIdsForWorkspace(state, workspaceId);
  const taskIds = new Set(state.tasks.filter((task) => scoped.has(task.projectId) && accessible.has(task.projectId)).map((task) => task.id));
  const memberIds = projectMemberIdentityIds(state);
  const breaks = new Set(state.focusSessions.filter((focus) => focus.mode !== "focus").map((focus) => focus.id));
  const events = new Map<string, ExecutionSignal[]>();
  const seenSignals = new Set<string>();
  for (const signal of state.executionSignals) {
    if (seenSignals.has(signal.id)) continue;
    seenSignals.add(signal.id);
    const list = events.get(signal.workSessionId);
    if (list) list.push(signal);
    else events.set(signal.workSessionId, [signal]);
  }

  let hasHistory = false;
  const counted = new Set<string>();
  for (const session of state.workSessions) {
    if (!account || session.status !== "ended" || !session.endedAt || counted.has(session.id) ||
        !taskIds.has(session.taskId) || breaks.has(session.focusSessionId) ||
        (workspaceId && session.workspaceId && session.workspaceId !== workspaceId)) continue;
    const own = session.ownerAccountId ? session.ownerAccountId === account.id : memberIds.has(session.executorMemberId ?? "");
    const start = Date.parse(session.startedAt);
    const end = Date.parse(session.endedAt);
    if (!own || !Number.isFinite(start) || !Number.isFinite(end) || end < start) continue;
    counted.add(session.id);
    hasHistory = true;
    if (end < boundaries[0] || start >= boundaries[7]) continue;

    const intervals = recordedFocusIntervals(session, events.get(session.id) ?? [], start, end);
    if (intervals) {
      for (const [from, to] of intervals) {
        for (let day = 0; day < 7; day++) {
          milliseconds[day] += Math.max(0, Math.min(to, boundaries[day + 1]) - Math.max(from, boundaries[day]));
        }
      }
    } else {
      const day = boundaries.findIndex((boundary) => boundary > end) - 1;
      if (day < 0) continue;
      const pausedAt = session.pausedAt ? Date.parse(session.pausedAt) : NaN;
      const activeEnd = pausedAt >= start && pausedAt <= end ? pausedAt : end;
      milliseconds[day] += Math.max(0, activeEnd - start - Math.max(0, session.totalPausedSeconds || 0) * 1000);
    }
  }
  const days = milliseconds.map((value, i) => ({ date: todayKey(new Date(boundaries[i])), seconds: Math.round(value / 1000) }));
  return { days, hasHistory, totalSeconds: days.reduce((sum, day) => sum + day.seconds, 0) };
}
