import type { ActiveTimer, AppState, SessionMode } from "./types";
import { completedFocusSessions } from "./domainQueries";
import { normalizeTimerSpeedMultiplier, plannedTimerEndAt } from "./timerSpeed";

type TimerRemainingInput = Pick<
  ActiveTimer,
  "duration" | "remaining" | "isRunning" | "plannedEndAt" | "pendingSettlement" | "speedMultiplier"
>;

export const calculateRemaining = (timer: TimerRemainingInput, now = new Date()) => {
  if (!timer.isRunning || timer.pendingSettlement === "pending") return Math.max(0, timer.remaining);
  const speedMultiplier = normalizeTimerSpeedMultiplier(timer.speedMultiplier);
  const remaining = Math.ceil(((new Date(timer.plannedEndAt).getTime() - now.getTime()) / 1000) * speedMultiplier);
  return Math.max(0, Math.min(timer.duration, remaining));
};

export const restoreTimer = (timer?: ActiveTimer, now = new Date()): ActiveTimer | undefined => {
  if (!timer) return undefined;
  if (!timer.isRunning) return timer;
  const remaining = calculateRemaining(timer, now);
  if (remaining > 0) return { ...timer, remaining };
  return { ...timer, remaining: 0, isRunning: false, pendingSettlement: undefined };
};

export const pauseTimer = (timer: ActiveTimer, nowIso: string): ActiveTimer => ({
  ...timer,
  isRunning: false,
  pausedAt: nowIso,
  remaining: calculateRemaining(timer, new Date(nowIso)),
});

export const resumeTimer = (timer: ActiveTimer, nowIso: string): ActiveTimer => {
  const pausedAt = timer.pausedAt ? new Date(timer.pausedAt).getTime() : new Date(nowIso).getTime();
  const pausedSeconds = Math.max(0, Math.round((new Date(nowIso).getTime() - pausedAt) / 1000));
  return {
    ...timer,
    isRunning: true,
    pausedAt: undefined,
    pendingSettlement: undefined,
    totalPausedSeconds: (timer.totalPausedSeconds ?? 0) + pausedSeconds,
    plannedEndAt: plannedTimerEndAt(nowIso, timer.remaining, timer.speedMultiplier),
  };
};

export const nextBreakMode = (state: AppState): SessionMode => {
  const focusCount = completedFocusSessions(state).length;
  return focusCount > 0 && focusCount % state.settings.longBreakEvery === 0 ? "long_break" : "short_break";
};
