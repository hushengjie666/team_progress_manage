import { cancelTimerNotification, scheduleTimerNotification } from "./notifications";
import { platformCapabilities } from "./platformCapabilities";
import type { ActiveTimer, Task } from "./types";

const TIMER_NOTIFICATION_ID = 21001;
const TIMER_SNAPSHOT_KEY = "timemanage.ios.activeTimer.v1";

type NativeTimerSnapshot = {
  timer: ActiveTimer;
  taskTitle?: string;
};

let lastSignature = "";

const signatureFor = (active?: ActiveTimer, task?: Task) => active
  ? [active.sessionId, active.isRunning, active.plannedEndAt, active.pausedAt, task?.id].join(":")
  : "none";

const storeSnapshot = (snapshot?: NativeTimerSnapshot) => {
  try {
    if (snapshot) localStorage.setItem(TIMER_SNAPSHOT_KEY, JSON.stringify(snapshot));
    else localStorage.removeItem(TIMER_SNAPSHOT_KEY);
  } catch {
    // Runtime state remains authoritative when WebKit storage is unavailable.
  }
};

const syncLiveActivity = async (active?: ActiveTimer, task?: Task) => {
  if (!platformCapabilities().supportsLiveActivity) return;
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("plugin:timer-native|sync_timer", {
    request: { payload: active ? {
      id: active.sessionId,
      mode: active.mode,
      taskTitle: task?.title ?? "无任务计时",
      isRunning: active.isRunning,
      plannedEndAt: active.plannedEndAt,
      remaining: active.remaining,
      duration: active.duration,
    } : null },
  });
};

export async function syncNativeTimer(active?: ActiveTimer, task?: Task): Promise<void> {
  const signature = signatureFor(active, task);
  if (signature === lastSignature) return;
  lastSignature = signature;
  storeSnapshot(active ? { timer: active, taskTitle: task?.title } : undefined);
  await cancelTimerNotification(TIMER_NOTIFICATION_ID);
  if (active?.isRunning) {
    await scheduleTimerNotification(
      TIMER_NOTIFICATION_ID,
      "专注计时结束",
      task?.title ?? "本次计时已结束",
      new Date(active.plannedEndAt),
    );
  }
  await syncLiveActivity(active, task);
}

export const resetNativeTimerSync = () => {
  lastSignature = "";
};
