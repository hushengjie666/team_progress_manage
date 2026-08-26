import { restoreTimer } from "./timerCalculations";
import { normalizeTimerSpeedMultiplier, timerSpeedMultiplierForSettings } from "./timerSpeed";
import type { ActiveTimer, AppState, Settings, WorkSession } from "./types";

const parsedTime = (value: string | undefined, fallback: number) => {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : fallback;
};

const runningStatus = (session: WorkSession) => session.status === "active";

const activeWorkSessionsForAccount = (state: AppState) => {
  const accountId = state.auth.account?.id;
  return state.workSessions
    .filter((session) =>
      (session.status === "active" || session.status === "paused") &&
      (!accountId || session.ownerAccountId === accountId),
    )
    .sort((left, right) => parsedTime(right.startedAt, 0) - parsedTime(left.startedAt, 0));
};

const timerFromWorkSession = (
  state: AppState,
  settings: Settings,
  session: WorkSession,
  local: AppState,
  serverTime: string | undefined,
  now: Date,
): ActiveTimer | undefined => {
  const focus = state.focusSessions.find((item) => item.id === session.focusSessionId);
  if (!focus) return undefined;

  const localTimer = local.activeTimer?.workSessionId === session.id ? local.activeTimer : undefined;
  const localSession = local.workSessions.find((item) => item.id === session.id);
  const isRunning = runningStatus(session);
  const resetWhilePaused = Boolean(
    localTimer && !isRunning && !localTimer.isRunning && localSession && localSession.startedAt !== session.startedAt,
  );
  if (localTimer && localTimer.isRunning === isRunning && !resetWhilePaused) {
    return isRunning ? restoreTimer(localTimer, now) : localTimer;
  }

  const duration = focus.duration ?? settings.focusMinutes * 60;
  const speedMultiplier = normalizeTimerSpeedMultiplier(
    localTimer?.speedMultiplier ?? timerSpeedMultiplierForSettings(settings),
  );
  const nowMs = now.getTime();
  const serverNowMs = parsedTime(serverTime, nowMs);
  const startedAtMs = parsedTime(session.startedAt, serverNowMs);
  const referenceMs = session.status === "paused"
    ? parsedTime(session.pausedAt ?? session.updatedAt, serverNowMs)
    : serverNowMs;
  const activeElapsed = Math.max(0, (referenceMs - startedAtMs) / 1000 - session.totalPausedSeconds);
  const remaining = resetWhilePaused
    ? duration
    : Math.max(0, Math.min(duration, Math.ceil(duration - activeElapsed * speedMultiplier)));
  const plannedEndAt = new Date(nowMs + (remaining / speedMultiplier) * 1000).toISOString();

  return {
    sessionId: focus.id,
    taskId: session.taskId,
    workSessionId: session.id,
    mode: focus.mode,
    duration,
    remaining,
    isRunning,
    startedAt: session.startedAt,
    plannedEndAt,
    pausedAt: session.pausedAt,
    totalPausedSeconds: session.totalPausedSeconds,
    cycleIndex: localTimer?.cycleIndex ?? 1,
    speedMultiplier: speedMultiplier > 1 ? speedMultiplier : undefined,
  };
};

export const recoverTeamActiveTimer = (
  state: AppState,
  settings: Settings,
  local: AppState,
  serverTime?: string,
  now = new Date(),
): ActiveTimer | undefined => {
  const session = activeWorkSessionsForAccount(state)[0];
  return session ? timerFromWorkSession(state, settings, session, local, serverTime, now) : undefined;
};

export const reconcileTeamActiveTimerAfterDelta = (
  local: AppState,
  merged: AppState,
  changedWorkSessionIds: ReadonlySet<string>,
  serverTime?: string,
  now = new Date(),
): ActiveTimer | undefined => {
  const replacementSession = activeWorkSessionsForAccount(merged)
    .find((session) => changedWorkSessionIds.has(session.id));
  const recoverReplacement = () => replacementSession
    ? timerFromWorkSession(merged, merged.settings, replacementSession, local, serverTime, now)
    : undefined;
  const active = local.activeTimer;
  if (active?.workSessionId) {
    if (!changedWorkSessionIds.has(active.workSessionId)) return active;
    const session = merged.workSessions.find((item) => item.id === active.workSessionId);
    if (!session || session.status === "ended") return recoverReplacement();
    return timerFromWorkSession(merged, merged.settings, session, local, serverTime, now);
  }
  if (changedWorkSessionIds.size === 0) return active;
  return recoverReplacement() ?? active;
};
