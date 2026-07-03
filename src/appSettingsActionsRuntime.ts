import { nowIso } from "./appModel";
import { requestTimerNotifications } from "./notifications";
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
    updateState((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
      updatedAt: nowIso(),
    }));
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
