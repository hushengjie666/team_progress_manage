import { isTauri } from "./env";
import type { Settings, StrictModeStatus, WhiteNoise } from "./types";

const makeStatus = (permissionState: StrictModeStatus["permission_state"], message: string): StrictModeStatus => ({
  active: permissionState === "granted" || permissionState === "unknown",
  platform: isTauri() ? "tauri_macos" : "browser",
  permission_state: permissionState,
  message,
});

export async function requestTimerNotifications(): Promise<StrictModeStatus> {
  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      return invoke<StrictModeStatus>("request_timer_notifications");
    } catch {
      return makeStatus("unknown", "Tauri 通知命令不可用，已降级为 WebView 通知。");
    }
  }

  if (!("Notification" in window)) {
    return makeStatus("unavailable", "当前浏览器不支持系统通知。");
  }
  const permission = await Notification.requestPermission();
  return makeStatus(
    permission === "granted" ? "granted" : "denied",
    permission === "granted" ? "通知权限已开启。" : "通知权限被拒绝，可在浏览器设置中重新开启。",
  );
}

export async function sendTimerNotification(settings: Settings, title: string, body: string): Promise<void> {
  if (!settings.notificationsEnabled) return;

  if (isTauri()) {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      await invoke("send_timer_notification", { title, body });
      return;
    } catch {
      // Continue to Web Notification fallback.
    }
  }

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body });
}

const audioContext = () => {
  const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
  return AudioCtor ? new AudioCtor() : null;
};

export function playTimerSound(settings: Settings): void {
  if (!settings.soundEnabled) return;
  const context = audioContext();
  if (!context) return;

  const oscillator = context.createOscillator();
  const gain = context.createGain();
  const profile = settings.timerEndSound;
  oscillator.type = profile === "bell" ? "sine" : profile === "digital" ? "square" : "triangle";
  oscillator.frequency.value = profile === "bell" ? 880 : profile === "digital" ? 520 : 660;
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, context.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.75);
  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + 0.8);
  window.setTimeout(() => void context.close(), 1000);
}

export function startWhiteNoise(kind: WhiteNoise, volume: number): () => void {
  if (kind === "off") return () => undefined;
  const context = audioContext();
  if (!context) return () => undefined;

  const seconds = 2;
  const buffer = context.createBuffer(1, seconds * context.sampleRate, context.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < data.length; index += 1) {
    const white = Math.random() * 2 - 1;
    if (kind === "brown") {
      last = (last + 0.02 * white) / 1.02;
      data[index] = last * 3.5;
    } else if (kind === "rain") {
      data[index] = white * (index % 7 === 0 ? 0.8 : 0.22);
    } else {
      data[index] = white * 0.28;
    }
  }

  const source = context.createBufferSource();
  const gain = context.createGain();
  source.buffer = buffer;
  source.loop = true;
  gain.gain.value = Math.min(1, Math.max(0, volume / 100)) * 0.22;
  source.connect(gain);
  gain.connect(context.destination);
  source.start();

  return () => {
    try {
      source.stop();
    } catch {
      // Source may already have stopped.
    }
    void context.close();
  };
}
