import { useEffect, useMemo, useRef } from "react";
import { platformCapabilities } from "./platformCapabilities";
import type { AppState, Task } from "./types";

export const DESKTOP_TIMER_TOGGLE_EVENT = "desktop-timer:toggle";
export const DESKTOP_TIMER_ABORT_EVENT = "desktop-timer:abort";

export type DesktopTimerStatusPayload = {
  mode: "focus" | "short_break" | "long_break";
  duration: number;
  remaining: number;
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

  return {
    mode: active.mode,
    duration: active.duration,
    remaining: active.remaining,
    isRunning: active.isRunning,
    prepared: active.prepared,
    taskTitle: task?.title,
    actualPomodoros: task?.actualPomodoros,
    estimatePomodoros: task?.estimatePomodoros,
  };
};

type DesktopTimerStatusOptions = {
  state: AppState | null;
  currentTask?: Task;
  toggleTimer: () => void;
  abortTimer: () => void;
};

const supportsDesktopTimerStatus = () => {
  const platform = platformCapabilities();
  return platform.isTauri && !platform.isMobile;
};

export function useDesktopTimerStatus({ state, currentTask, toggleTimer, abortTimer }: DesktopTimerStatusOptions) {
  const payloadRef = useRef<DesktopTimerStatusPayload | null>(null);
  const payload = useMemo(
    () => buildDesktopTimerStatusPayload(
      state?.auth.status === "authenticated" ? state : null,
      currentTask,
    ),
    [
      state,
      currentTask?.id,
      currentTask?.title,
      currentTask?.actualPomodoros,
      currentTask?.estimatePomodoros,
    ],
  );
  payloadRef.current = payload;

  useEffect(() => {
    if (!supportsDesktopTimerStatus()) return;
    void import("@tauri-apps/api/core")
      .then(({ invoke }) => invoke("sync_desktop_timer_status_command", { payload: payloadRef.current }))
      .catch((error) => console.error("Failed to sync desktop timer status", error));
  }, [payload]);

  useEffect(() => {
    if (!supportsDesktopTimerStatus()) return undefined;
    let disposed = false;
    const unlisteners: Array<() => void> = [];

    const attach = async () => {
      const { listen } = await import("@tauri-apps/api/event");
      const removeToggle = await listen(DESKTOP_TIMER_TOGGLE_EVENT, toggleTimer, {
        target: { kind: "WebviewWindow", label: "main" },
      });
      const removeAbort = await listen(DESKTOP_TIMER_ABORT_EVENT, abortTimer, {
        target: { kind: "WebviewWindow", label: "main" },
      });
      if (disposed) {
        removeToggle();
        removeAbort();
        return;
      }
      unlisteners.push(removeToggle, removeAbort);
    };

    void attach().catch((error) => {
      if (!disposed) console.error("Failed to attach desktop timer status listeners", error);
    });
    return () => {
      disposed = true;
      unlisteners.forEach((unlisten) => unlisten());
    };
  }, [abortTimer, toggleTimer]);
}
