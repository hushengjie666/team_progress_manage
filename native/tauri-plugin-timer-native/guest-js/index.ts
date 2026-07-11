import { invoke } from "@tauri-apps/api/core";

export type TimerActivityPayload = {
  id: string;
  mode: string;
  taskTitle: string;
  isRunning: boolean;
  plannedEndAt: string;
  remaining: number;
  duration: number;
};

export const syncTimer = (payload: TimerActivityPayload | null) =>
  invoke<void>("plugin:timer-native|sync_timer", { request: { payload } });

export const startAudio = (kind: string, volume: number) =>
  invoke<void>("plugin:timer-native|start_audio", { request: { kind, volume } });

export const stopAudio = () => invoke<void>("plugin:timer-native|stop_audio");
