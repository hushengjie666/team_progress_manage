import { SettingsView } from "./SettingsView";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";

type AppSettingsRouteProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "chrome"
  | "settingsActions"
  | "backendActions"
  | "workspaceAccountActions"
  | "loadDemoData"
>;

export function AppSettingsRoute({
  view,
  shellState,
  chrome,
  settingsActions,
  backendActions,
  workspaceAccountActions,
  loadDemoData,
}: AppSettingsRouteProps) {
  const { state } = view;
  const {
    backendPassword,
    setBackendPassword,
    backendDiagnostic,
    settingsSection,
    setSettingsSection,
  } = shellState;

  return (
    <SettingsView
      projectMembers={state.projectMembers}
      accounts={chrome.platformAccounts}
      settings={state.settings}
      dailyGoal={state.rewardState.dailyGoal}
      backend={state.backend}
      dataSummary={chrome.settingsDataSummary}
      activeSection={settingsSection}
      setActiveSection={setSettingsSection}
      updateSettings={settingsActions.updateSettings}
      createAccount={workspaceAccountActions.createPlatformAccount}
      updateAccount={workspaceAccountActions.updatePlatformAccountProfile}
      updateAccountPassword={workspaceAccountActions.updatePlatformAccountPassword}
      disableAccount={workspaceAccountActions.disablePlatformAccount}
      canManageMembers={chrome.canManageMembers}
      askNotificationPermissions={settingsActions.askNotificationPermissions}
      backendPassword={backendPassword}
      setBackendPassword={setBackendPassword}
      updateBackendSetting={backendActions.updateBackendSetting}
      checkBackendHealth={backendActions.checkBackendHealth}
      handleBackendLogin={backendActions.handleBackendLogin}
      handleBackendRefresh={backendActions.handleBackendRefresh}
      runBackendDiagnostics={backendActions.runBackendDiagnostics}
      backendDiagnostic={backendDiagnostic}
      loadDemoData={loadDemoData}
    />
  );
}
