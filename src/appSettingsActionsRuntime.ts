import { nowIso } from "./appModel";
import { calculateRemaining } from "./timerCalculations";
import { requestTimerNotifications } from "./notifications";
import { normalizeTimerSpeedMultiplier, plannedTimerEndAt, timerSpeedMultiplierForSettings } from "./timerSpeed";
import type { AppState } from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

type UpdateState = (updater: (value: AppState) => AppState) => void;

export type AppSettingsActionsRuntimeOptions = {
  updateState: UpdateState;
  runTeamCommand: RunTeamDomainCommand;
  setToast: (message: string) => void;
};

export type AppSettingsActionsRuntime = {
  updateSettings: <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => void;
  askNotificationPermissions: () => Promise<void>;
};

export function createAppSettingsActionsRuntime({
  updateState,
  runTeamCommand,
  setToast,
}: AppSettingsActionsRuntimeOptions): AppSettingsActionsRuntime {
  const updateSettings = <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => {
    if (key !== "devTimerSpeed100xEnabled") {
      void runTeamCommand({ kind: "settings", patch: { [key]: value } });
      return;
    }
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
    await runTeamCommand({
      kind: "settings",
      patch: {
        notificationsEnabled: status.permission_state !== "denied" && status.permission_state !== "unavailable",
        notificationSettings: { permissionState: status.permission_state, lastCheckedAt: nowIso() },
      },
    });
    setToast(status.message);
  };

  return {
    updateSettings,
    askNotificationPermissions,
  };
}
