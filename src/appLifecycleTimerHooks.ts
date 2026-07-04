import { useEffect } from "react";
import {
  finishExpiredTimerInState,
  modeLabel,
  nowIso,
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

export function useRunningTimerInterval({
  state,
  stateRef,
  setState,
  setToast,
  commitTeamData,
}: Pick<AppLifecycleHooksOptions, "state" | "stateRef" | "setState" | "setToast" | "commitTeamData">) {
  useEffect(() => {
    if (!state?.activeTimer?.isRunning) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.activeTimer?.isRunning) return;
      if (current.backend.status === "saving") return;
      const nextRemaining = calculateRemaining(current.activeTimer);
      if (nextRemaining > 0) {
        setState({
          ...current,
          activeTimer: { ...current.activeTimer, remaining: nextRemaining },
          updatedAt: nowIso(),
        });
        return;
      }
      const timestamp = nowIso();
      const title = `${modeLabel[current.activeTimer.mode]}已结束`;
      const body =
        current.activeTimer.mode === "focus"
          ? "记录一个番茄，休息一下再继续。"
          : "休息结束，可以回到当下清单。";
      setToast(title);
      announceTimerEnd(current.settings, title, body);
      commitTeamData(current, finishExpiredTimerInState(current, timestamp));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [state?.activeTimer?.isRunning]);
}

export function useTimerRestoreListeners({
  stateRef,
  setState,
  setToast,
  commitTeamData,
}: Pick<AppLifecycleHooksOptions, "stateRef" | "setState" | "setToast" | "commitTeamData">) {
  useEffect(() => {
    const handle = () => {
      const current = stateRef.current;
      if (!current?.activeTimer) return;
      if (current.backend.status === "saving") return;
      const timestamp = nowIso();
      const shouldFinish = shouldFinishExpiredTimerInState(current, timestamp);
      const next = restoreTimerInState(current, timestamp);
      if (shouldFinish) {
        const title = `${modeLabel[current.activeTimer.mode]}已结束`;
        setToast(`${title}，已自动记录`);
        commitTeamData(current, next);
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
  commitTeamData,
}: Pick<AppLifecycleHooksOptions, "state" | "stateRef" | "reminderSentRef" | "commitTeamData">) {
  useEffect(() => {
    if (!state?.settings.notificationsEnabled) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      runDueTaskReminders(current, reminderSentRef.current, commitTeamData);
    }, 30_000);
    return () => window.clearInterval(handle);
  }, [state?.settings.notificationsEnabled]);
}
