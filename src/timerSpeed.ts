import type { Settings } from "./types";

export const DEV_TIMER_SPEED_MULTIPLIER = 100;

export const normalizeTimerSpeedMultiplier = (value: unknown) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 1 ? numeric : 1;
};

export const timerSpeedMultiplierForSettings = (settings: Pick<Settings, "devTimerSpeed100xEnabled">) =>
  import.meta.env.DEV && settings.devTimerSpeed100xEnabled ? DEV_TIMER_SPEED_MULTIPLIER : 1;

export const plannedTimerEndAt = (timestamp: string, remainingSeconds: number, speedMultiplier?: number) =>
  new Date(
    new Date(timestamp).getTime() +
      (Math.max(0, remainingSeconds) / normalizeTimerSpeedMultiplier(speedMultiplier)) * 1000,
  ).toISOString();
