import { useEffect } from "react";
import {
  modeLabel,
  nowIso,
  finishExpiredTimerInState,
  shouldFinishExpiredTimerInState,
} from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { platformCapabilities } from "./platformCapabilities";
import { calculateRemaining } from "./domain";
import {
  announceTimerEnd,
  runDueTaskReminders,
  stopWhiteNoise,
  updateWhiteNoisePlayback,
  updateActiveTimerPresence,
} from "./timerRuntime";
import { normalizeTimerSpeedMultiplier } from "./timerSpeed";
import type { ActiveTimer, Settings } from "./types";

const timerEndBody = (mode: ActiveTimer["mode"]) =>
  mode === "focus"
    ? "记录一个番茄，休息一下再继续。"
    : "休息结束，可以回到当下清单。";

const announceTimerEndForRuntime = (settings: Settings, active: ActiveTimer, title: string) => {
  announceTimerEnd(settings, title, timerEndBody(active.mode));
};

export function useRunningTimerInterval({
  state,
  stateRef,
  setState,
  setToast,
  runTeamCommand,
}: Pick<AppLifecycleHooksOptions, "state" | "stateRef" | "setState" | "setToast" | "runTeamCommand">) {
  useEffect(() => {
    const active = state?.activeTimer;
    if (!active || (!active.isRunning && active.pendingSettlement !== "pending")) return;
    const refresh = () => {
      const current = stateRef.current;
      const timer = current?.activeTimer;
      if (!current || !timer || timer.sessionId !== active.sessionId || current.backend.status === "saving" ||
        current.backend.status === "incompatible") return;
      const timestamp = nowIso();
      if (!shouldFinishExpiredTimerInState(current, timestamp)) {
        const remaining = calculateRemaining(timer, new Date(timestamp));
        if (remaining !== timer.remaining) {
          const next = { ...current, activeTimer: { ...timer, remaining }, updatedAt: timestamp };
          stateRef.current = next;
          setState(next);
        }
        return;
      }
      const next = finishExpiredTimerInState(current, timestamp);
      stateRef.current = next;
      setState(next);
      const title = `${modeLabel[timer.mode]}已结束`;
      const nextMode = next.activeTimer?.mode;
      setToast(nextMode ? `${title}，${modeLabel[nextMode]}已准备` : title);
      announceTimerEndForRuntime(current.settings, timer, title);
      if (timer.workSessionId) {
        const session = current.workSessions.find((item) => item.id === timer.workSessionId);
        void runTeamCommand({
          kind: "action", resource: "work-sessions", id: timer.workSessionId, action: "finish",
          idempotencyKey: `finish:${timer.workSessionId}:completed`,
          workspaceId: current.tasks.find((item) => item.id === session?.taskId)?.workspaceId,
          payload: { outcome: "completed" },
        });
      }
    };

    refresh();
    const intervalDelay = normalizeTimerSpeedMultiplier(active.speedMultiplier) > 1 ? 250 : 1000;
    const handle = window.setInterval(refresh, intervalDelay);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    const platform = platformCapabilities();
    let disposed = false;
    let unlisten: (() => void) | undefined;
    if (platform.isTauri && !platform.isMobile) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<string>("desktop-timer:expired", ({ payload }) => {
          if (!disposed && payload === active.sessionId) refresh();
        }, { target: { kind: "WebviewWindow", label: "main" } }),
      ).then((remove) => {
        if (disposed) remove();
        else unlisten = remove;
      }).catch((error) => console.error("Failed to attach desktop timer expiration listener", error));
    }
    return () => {
      disposed = true;
      unlisten?.();
      window.clearInterval(handle);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [
    state?.activeTimer?.sessionId,
    state?.activeTimer?.isRunning,
    state?.activeTimer?.pendingSettlement,
    state?.activeTimer?.speedMultiplier,
    state?.backend.status,
  ]);
}

export function useTimerRuntimeEffects({
  state,
  stopNoiseRef,
}: Pick<AppLifecycleHooksOptions, "state" | "stopNoiseRef">) {
  useEffect(() => {
    updateWhiteNoisePlayback(state, stopNoiseRef);
    return () => stopWhiteNoise(stopNoiseRef);
  }, [
    state,
    state?.activeTimer?.isRunning,
    state?.activeTimer?.mode,
    state?.settings.soundEnabled,
    state?.settings.whiteNoise,
    state?.settings.whiteNoiseVolume,
  ]);

  useEffect(() => {
    void updateActiveTimerPresence(state?.activeTimer);
  }, [state?.activeTimer?.remaining, state?.activeTimer?.mode, state?.activeTimer?.sessionId]);
}

export function useTaskReminderInterval({
  state,
  stateRef,
  reminderSentRef,
  runTeamCommand,
}: Pick<AppLifecycleHooksOptions, "state" | "stateRef" | "reminderSentRef" | "runTeamCommand">) {
  useEffect(() => {
    if (!state?.settings.notificationsEnabled || state.backend.status === "incompatible") return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current || current.backend.status === "incompatible") return;
      runDueTaskReminders(current, reminderSentRef.current, (taskId, timestamp) => {
        const task = current.tasks.find((item) => item.id === taskId);
        if (task) void runTeamCommand({ kind: "patch", entity: "task", id: taskId, workspaceId: task.workspaceId, patch: { lastReminderSentAt: timestamp } });
      });
    }, 30_000);
    return () => window.clearInterval(handle);
  }, [state?.settings.notificationsEnabled]);
}
