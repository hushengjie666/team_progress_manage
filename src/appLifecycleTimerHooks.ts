import { useEffect } from "react";
import {
  modeLabel,
  nowIso,
  finishExpiredTimerInState,
  restoreTimerInState,
  shouldFinishExpiredTimerInState,
} from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
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
    if (!state?.activeTimer || state.backend.status === "incompatible") return;
    const settleExpiredTimer = () => {
      const current = stateRef.current;
      if (!current?.activeTimer || current.backend.status === "saving" || current.backend.status === "incompatible") return false;
      const timestamp = nowIso();
      if (!shouldFinishExpiredTimerInState(current, timestamp)) return false;
      const title = `${modeLabel[current.activeTimer.mode]}已结束`;
      const next = finishExpiredTimerInState(current, timestamp);
      const nextMode = next.activeTimer?.mode;
      setToast(nextMode ? `${title}，${modeLabel[nextMode]}已准备` : title);
      announceTimerEndForRuntime(current.settings, current.activeTimer, title);
      const active = current.activeTimer;
      if (active.workSessionId) {
        const session = current.workSessions.find((item) => item.id === active.workSessionId);
        void runTeamCommand({ kind: "action", resource: "work-sessions", id: active.workSessionId, action: "finish", workspaceId: session ? current.tasks.find((item) => item.id === session.taskId)?.workspaceId : undefined, payload: { outcome: "completed" } });
      }
      setState(next);
      return true;
    };
    if (state.activeTimer.pendingSettlement === "pending") {
      settleExpiredTimer();
      return;
    }
    if (!state.activeTimer.isRunning) return;
    const intervalDelay = normalizeTimerSpeedMultiplier(state.activeTimer.speedMultiplier) > 1 ? 250 : 1000;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.activeTimer?.isRunning) return;
      if (current.backend.status === "saving" || current.backend.status === "incompatible") return;
      const nextRemaining = calculateRemaining(current.activeTimer);
      if (nextRemaining > 0) {
        setState({
          ...current,
          activeTimer: { ...current.activeTimer, remaining: nextRemaining },
          updatedAt: nowIso(),
        });
        return;
      }
      settleExpiredTimer();
    }, intervalDelay);
    return () => window.clearInterval(handle);
  }, [
    state?.activeTimer?.sessionId,
    state?.activeTimer?.isRunning,
    state?.activeTimer?.pendingSettlement,
    state?.activeTimer?.speedMultiplier,
    state?.backend.status,
  ]);
}

export function useTimerRestoreListeners({
  stateRef,
  setState,
  setToast,
  runTeamCommand,
}: Pick<AppLifecycleHooksOptions, "stateRef" | "setState" | "setToast" | "runTeamCommand">) {
  useEffect(() => {
    const handle = () => {
      const current = stateRef.current;
      if (!current?.activeTimer) return;
      if (current.backend.status === "saving" || current.backend.status === "incompatible") return;
      const timestamp = nowIso();
      const shouldFinish = shouldFinishExpiredTimerInState(current, timestamp);
      const next = restoreTimerInState(current, timestamp);
      if (shouldFinish) {
        const title = `${modeLabel[current.activeTimer.mode]}已结束`;
        announceTimerEndForRuntime(current.settings, current.activeTimer, title);
        const nextMode = next.activeTimer?.mode;
        setToast(nextMode ? `${title}，${modeLabel[nextMode]}已准备` : `${title}，已自动记录`);
        if (current.activeTimer.workSessionId) {
          const session = current.workSessions.find((item) => item.id === current.activeTimer?.workSessionId);
          void runTeamCommand({ kind: "action", resource: "work-sessions", id: current.activeTimer.workSessionId, action: "finish", workspaceId: session ? current.tasks.find((item) => item.id === session.taskId)?.workspaceId : undefined, payload: { outcome: "completed" } });
        }
        setState(next);
        return;
      }
      setState(next);
    };
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("focus", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("focus", handle);
    };
  }, []);
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
