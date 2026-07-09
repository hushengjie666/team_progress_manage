import type { ActiveTimer, AppState, Task, TimerEndSound, TimerSettlement } from "./types";
import { calculateRemaining } from "./timerCalculations";

export type DesktopTimerPayload = {
  sessionId: string;
  taskId?: string;
  mode: ActiveTimer["mode"];
  duration: number;
  remaining: number;
  isRunning: boolean;
  plannedEndAt: string;
  pendingSettlement?: TimerSettlement;
  speedMultiplier?: number;
  taskTitle?: string;
  actualPomodoros?: number;
  estimatePomodoros?: number;
  soundEnabled: boolean;
  timerEndSound: TimerEndSound;
  timerEndSoundVolume: number;
  timerEndSoundRepeats: number;
  sentAt: string;
};

export type DesktopTimerEndPayload = Pick<
  DesktopTimerPayload,
  "sessionId" | "mode" | "soundEnabled" | "timerEndSound" | "timerEndSoundVolume" | "timerEndSoundRepeats"
>;

export const buildDesktopTimerPayload = (
  state: AppState | null,
  task: Task | undefined,
  sentAt = new Date().toISOString(),
): DesktopTimerPayload | null => {
  const active = state?.activeTimer;
  if (!active) return null;

  return {
    sessionId: active.sessionId,
    taskId: active.taskId,
    mode: active.mode,
    duration: active.duration,
    remaining: active.remaining,
    isRunning: active.isRunning,
    plannedEndAt: active.plannedEndAt,
    pendingSettlement: active.pendingSettlement,
    speedMultiplier: active.speedMultiplier,
    taskTitle: task?.title,
    actualPomodoros: task?.actualPomodoros,
    estimatePomodoros: task?.estimatePomodoros,
    soundEnabled: state.settings.soundEnabled,
    timerEndSound: state.settings.timerEndSound,
    timerEndSoundVolume: state.settings.timerEndSoundVolume,
    timerEndSoundRepeats: state.settings.timerEndSoundRepeats,
    sentAt,
  };
};

export const displayRemainingForDesktopTimer = (
  payload: Pick<DesktopTimerPayload, "duration" | "remaining" | "isRunning" | "plannedEndAt" | "pendingSettlement" | "speedMultiplier">,
  now = new Date(),
) => {
  return calculateRemaining(payload, now);
};
