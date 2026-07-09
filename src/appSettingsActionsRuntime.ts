import { nowIso } from "./appModel";
import { calculateRemaining } from "./timerCalculations";
import { requestTimerNotifications } from "./notifications";
import { normalizeTimerSpeedMultiplier, plannedTimerEndAt, timerSpeedMultiplierForSettings } from "./timerSpeed";
import type { AppState } from "./types";

type UpdateState = (updater: (value: AppState) => AppState) => void;

export type AppSettingsActionsRuntimeOptions = {
  updateState: UpdateState;
  setToast: (message: string) => void;
};

export type AppSettingsActionsRuntime = {
  updateSettings: <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => void;
  askNotificationPermissions: () => Promise<void>;
};

export function createAppSettingsActionsRuntime({
  updateState,
  setToast,
}: AppSettingsActionsRuntimeOptions): AppSettingsActionsRuntime {
  const updateSettings = <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => {
    updateState((current) => {
      const timestamp = nowIso();
      const settings = { ...current.settings, [key]: value };
      if (key !== "devTimerSpeed100xEnabled" || !current.activeTimer) {
        return {
          ...current,
          settings,
          updatedAt: timestamp,
        };
      }

      const remaining = calculateRemaining(current.activeTimer, new Date(timestamp));
      const speedMultiplier = normalizeTimerSpeedMultiplier(timerSpeedMultiplierForSettings(settings));
      return {
        ...current,
        settings,
        activeTimer: {
          ...current.activeTimer,
          remaining,
          plannedEndAt: plannedTimerEndAt(timestamp, remaining, speedMultiplier),
          speedMultiplier: speedMultiplier > 1 ? speedMultiplier : undefined,
        },
        updatedAt: timestamp,
      };
    });
  };

  const askNotificationPermissions = async () => {
    const status = await requestTimerNotifications();
    updateState((value) => ({
      ...value,
      settings: {
        ...value.settings,
        notificationsEnabled: status.permission_state !== "denied" && status.permission_state !== "unavailable",
        notificationSettings: {
          permissionState: status.permission_state,
          lastCheckedAt: nowIso(),
        },
      },
      updatedAt: nowIso(),
    }));
    setToast(status.message);
  };

  return {
    updateSettings,
    askNotificationPermissions,
  };
}
