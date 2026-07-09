import type { PermissionState, Settings, WhiteNoise } from "./types";

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}

type NotificationPermissionStatus = {
  permission_state: PermissionState;
  message: string;
};

type TimerSoundSettings = Pick<Settings, "soundEnabled" | "timerEndSound"> &
  Partial<Pick<Settings, "timerEndSoundRepeats" | "timerEndSoundVolume">>;

export const normalizeTimerSoundRepeats = (value: unknown) =>
  Number.isFinite(value) ? Math.min(5, Math.max(1, Math.round(Number(value)))) : 1;

export const normalizeTimerSoundVolume = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.min(100, Math.max(0, Math.round(numeric))) : 100;
};

const makeStatus = (permissionState: PermissionState, message: string): NotificationPermissionStatus => ({
  permission_state: permissionState,
  message,
});

export async function requestTimerNotifications(): Promise<NotificationPermissionStatus> {
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
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, { body });
}

const audioContext = () => {
  const AudioCtor = window.AudioContext ?? window.webkitAudioContext;
  return AudioCtor ? new AudioCtor() : null;
};

const resumeAudioContext = (context: AudioContext) => {
  if (context.state === "suspended") {
    void context.resume().catch(() => undefined);
  }
};

export function playTimerSound(settings: TimerSoundSettings): void {
  if (!settings.soundEnabled) return;
  const volume = normalizeTimerSoundVolume(settings.timerEndSoundVolume);
  if (volume <= 0) return;
  const context = audioContext();
  if (!context) return;
  resumeAudioContext(context);

  const profile = settings.timerEndSound;
  const repeats = normalizeTimerSoundRepeats(settings.timerEndSoundRepeats);
  const peakGain = 0.18 * (volume / 100);
  const duration = 0.8;
  const gap = 0.25;

  for (let index = 0; index < repeats; index += 1) {
    const startAt = context.currentTime + index * (duration + gap);
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = profile === "bell" ? "sine" : profile === "digital" ? "square" : "triangle";
    oscillator.frequency.value = profile === "bell" ? 880 : profile === "digital" ? 520 : 660;
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, peakGain), startAt + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + 0.75);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(startAt);
    oscillator.stop(startAt + duration);
  }

  window.setTimeout(() => void context.close(), (duration + gap) * repeats * 1000 + 200);
}

export function startWhiteNoise(kind: WhiteNoise, volume: number): () => void {
  if (kind === "off") return () => undefined;
  const context = audioContext();
  if (!context) return () => undefined;
  resumeAudioContext(context);

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
  gain.gain.value = Math.min(1, Math.max(0, volume / 100)) * 0.36;
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
