import { useEffect, useMemo } from "react";
import type { AppFocusActionsRuntime } from "./appFocusActionsRuntime";
import { shouldFinishExpiredTimerInState } from "./appTimerExpirationState";
import { normalizeTimerSpeedMultiplier } from "./timerSpeed";
import { platformCapabilities } from "./platformCapabilities";
import type { AppState, Task } from "./types";

export const DESKTOP_TIMER_TOGGLE_EVENT = "desktop-timer:toggle";
export const DESKTOP_TIMER_ABORT_EVENT = "desktop-timer:abort";
export const DESKTOP_TIMER_SHORT_BREAK_EVENT = "desktop-timer:short-break";

export type DesktopTimerStatusPayload = {
  sessionId: string;
  mode: "focus" | "short_break" | "long_break";
  duration: number;
  remaining: number;
  deadlineMs?: number;
  speedMultiplier: number;
  isRunning: boolean;
  prepared?: boolean;
  taskTitle?: string;
  actualPomodoros?: number;
  estimatePomodoros?: number;
};

export const buildDesktopTimerStatusPayload = (
  state: AppState | null,
  task: Task | undefined,
): DesktopTimerStatusPayload | null => {
  const active = state?.activeTimer;
  if (!active) return null;

  const isRunning = active.isRunning && active.pendingSettlement !== "pending";
  return {
    sessionId: active.sessionId,
    mode: active.mode,
    duration: active.duration,
    remaining: active.remaining,
    deadlineMs: isRunning ? Date.parse(active.plannedEndAt) : undefined,
    speedMultiplier: normalizeTimerSpeedMultiplier(active.speedMultiplier),
    isRunning,
    prepared: active.prepared,
    taskTitle: task?.title,
    actualPomodoros: task?.actualPomodoros,
    estimatePomodoros: task?.estimatePomodoros,
  };
};

export const startDesktopShortBreak = async (
  state: AppState | null,
  sessionId: string,
  beginTimer: AppFocusActionsRuntime["beginTimer"] | undefined,
) => {
  const active = state?.activeTimer;
  if (
    !beginTimer || !state || state.auth.status !== "authenticated" || !state.auth.token ||
    state.backend.status === "incompatible" || !active || active.sessionId !== sessionId ||
    active.mode === "short_break" || shouldFinishExpiredTimerInState(state)
  ) return;

  await beginTimer("short_break");
};

export type DesktopTimerActionSource = Pick<DesktopTimerStatusPayload, "sessionId" | "isRunning" | "deadlineMs">;

export function matchesDesktopTimerAction(state: AppState | null, source: DesktopTimerActionSource) {
  const active = state?.activeTimer;
  return Boolean(state && active && active.sessionId === source.sessionId && active.isRunning === source.isRunning &&
    (!active.isRunning || Date.parse(active.plannedEndAt) === source.deadlineMs) && !shouldFinishExpiredTimerInState(state));
}

type DesktopTimerActions = {
  toggleTimer: (source: DesktopTimerActionSource) => void;
  abortTimer: (source: DesktopTimerActionSource) => void;
  startShortBreak: (sessionId: string) => Promise<void>;
};

type DesktopTimerStatusOptions = DesktopTimerActions & {
  state: AppState | null;
  currentTask?: Task;
};

const supportsDesktopTimerStatus = () => {
  const platform = platformCapabilities();
  return platform.isTauri && !platform.isMobile;
};

export function attachDesktopTimerListeners({ toggleTimer, abortTimer, startShortBreak }: DesktopTimerActions) {
  let disposed = false;
  const unlisteners: Array<() => void> = [];

  const attach = async () => {
    const { listen } = await import("@tauri-apps/api/event");
    if (disposed) return;

    const attachListener = async <T,>(event: string, handle: (payload: T) => void) => {
      const unlisten = await listen<T>(event, ({ payload }) => {
        if (!disposed) handle(payload);
      }, { target: { kind: "WebviewWindow", label: "main" } });
      if (disposed) unlisten();
      else unlisteners.push(unlisten);
    };

    await Promise.all([
      attachListener(DESKTOP_TIMER_TOGGLE_EVENT, toggleTimer),
      attachListener(DESKTOP_TIMER_ABORT_EVENT, abortTimer),
      attachListener<string>(DESKTOP_TIMER_SHORT_BREAK_EVENT, (sessionId) => {
        void startShortBreak(sessionId).catch((error) => console.error("Failed to start desktop short break", error));
      }),
    ]);
  };

  void attach().catch((error) => {
    if (!disposed) console.error("Failed to attach desktop timer status listeners", error);
  });
  return () => {
    disposed = true;
    unlisteners.forEach((unlisten) => unlisten());
  };
}

export function useDesktopTimerStatus({ state, currentTask, toggleTimer, abortTimer, startShortBreak }: DesktopTimerStatusOptions) {
  const active = state?.activeTimer;
  const payload = useMemo(
    () => buildDesktopTimerStatusPayload(
      state?.auth.status === "authenticated" ? state : null,
      currentTask,
    ),
    [
      state?.auth.status,
      active?.sessionId, active?.mode, active?.duration, active?.prepared,
      active?.isRunning, active?.plannedEndAt, active?.speedMultiplier, active?.pendingSettlement,
      active?.isRunning ? undefined : active?.remaining,
      currentTask?.id,
      currentTask?.title,
      currentTask?.actualPomodoros,
      currentTask?.estimatePomodoros,
    ],
  );


  useEffect(() => {
    if (!supportsDesktopTimerStatus()) return;
    let current = true;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => current ? invoke("sync_desktop_timer_status_command", { payload }) : undefined)
      .catch((error) => console.error("Failed to sync desktop timer status", error));
    return () => { current = false; };
  }, [payload]);

  useEffect(() => {
    if (!supportsDesktopTimerStatus()) return undefined;
    return attachDesktopTimerListeners({ toggleTimer, abortTimer, startShortBreak });
  }, [abortTimer, startShortBreak, toggleTimer]);
}
