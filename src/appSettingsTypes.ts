import type { CalendarViewMode, ReportFilter } from "./planningTypes";

export type PermissionState = "unknown" | "granted" | "denied" | "unavailable";
export type TimerEndSound = "soft" | "bell" | "digital";
export type WhiteNoise = "off" | "rain" | "brown" | "cafe";

export interface NotificationSettings {
  permissionState: PermissionState;
  lastCheckedAt?: string;
}

export interface Settings {
  focusMinutes: number;
  shortBreakMinutes: number;
  longBreakMinutes: number;
  longBreakEvery: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  notificationsEnabled: boolean;
  soundEnabled: boolean;
  whiteNoise: WhiteNoise;
  whiteNoiseVolume: number;
  timerEndSound: TimerEndSound;
  notificationSettings: NotificationSettings;
  advancedSyncVisible?: boolean;
  reportFilter?: ReportFilter;
  calendarViewMode?: CalendarViewMode;
  commandPaletteHintDismissed?: boolean;
}
