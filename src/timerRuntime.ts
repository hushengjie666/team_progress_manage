import { formatTime, modeLabel, nowIso } from "./appModel";
import { updateDesktopTimerPresence } from "./nativeDesktop";
import { playTimerSound, sendTimerNotification, startWhiteNoise } from "./notifications";
import type { ActiveTimer, AppState, Settings } from "./types";

type StopNoiseRef = { current: (() => void) | null };
type CommitTeamState = (before: AppState, after: AppState) => void;

export const stopWhiteNoise = (stopNoiseRef: StopNoiseRef) => {
  stopNoiseRef.current?.();
  stopNoiseRef.current = null;
};

export const syncWhiteNoise = (state: AppState | null | undefined, stopNoiseRef: StopNoiseRef) => {
  stopWhiteNoise(stopNoiseRef);
  if (!state?.activeTimer?.isRunning || !state.settings.soundEnabled || state.settings.whiteNoise === "off") return;
  stopNoiseRef.current = startWhiteNoise(state.settings.whiteNoise, state.settings.whiteNoiseVolume);
};

export const updateActiveTimerPresence = (active?: ActiveTimer) => {
  const title = active
    ? `${formatTime(active.remaining)} · ${modeLabel[active.mode]} · TimeManage`
    : "TimeManage";
  return updateDesktopTimerPresence(Boolean(active), title);
};

export const announceTimerEnd = (settings: Settings, title: string, body: string) => {
  playTimerSound(settings);
  void sendTimerNotification(settings, title, body);
};

export const runDueTaskReminders = (
  state: AppState,
  reminderSentIds: Set<string>,
  commitTeamState: CommitTeamState,
  nowMs = Date.now(),
  timestamp = nowIso(),
) => {
  if (!state.settings.notificationsEnabled) return;
  if (state.sync.status === "syncing") return;

  for (const task of state.tasks) {
    if (!task.reminderAt || task.status === "completed" || reminderSentIds.has(task.id) || task.lastReminderSentAt) continue;
    const reminderTime = new Date(task.reminderAt).getTime();
    if (!Number.isNaN(reminderTime) && reminderTime <= nowMs) {
      reminderSentIds.add(task.id);
      void sendTimerNotification(state.settings, "任务提醒", task.title);
      commitTeamState(state, {
        ...state,
        tasks: state.tasks.map((item) =>
          item.id === task.id ? { ...item, lastReminderSentAt: timestamp, updatedAt: timestamp } : item,
        ),
        updatedAt: timestamp,
      });
    }
  }
};
