import { SettingsView } from "./SettingsView";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";

type AppSettingsRouteProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "chrome"
  | "settingsActions"
  | "dataPortability"
  | "syncActions"
  | "workspaceAccountActions"
  | "loadDemoData"
>;

export function AppSettingsRoute({
  view,
  shellState,
  chrome,
  settingsActions,
  dataPortability,
  syncActions,
  workspaceAccountActions,
  loadDemoData,
}: AppSettingsRouteProps) {
  const { state } = view;
  const {
    syncPassword,
    setSyncPassword,
    importSummary,
    syncDiagnostic,
    settingsSection,
    setSettingsSection,
  } = shellState;

  return (
    <SettingsView
      projectMembers={state.projectMembers}
      accounts={chrome.platformAccounts}
      settings={state.settings}
      dailyGoal={state.rewardState.dailyGoal}
      sync={state.sync}
      backupSnapshots={state.backupSnapshots}
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
      syncPassword={syncPassword}
      setSyncPassword={setSyncPassword}
      updateSyncSetting={syncActions.updateSyncSetting}
      checkSyncHealth={syncActions.checkSyncHealth}
      handleSyncLogin={syncActions.handleSyncLogin}
      handleSyncNow={syncActions.handleSyncNow}
      runSyncDiagnostics={syncActions.runSyncDiagnostics}
      syncDiagnostic={syncDiagnostic}
      exportJson={dataPortability.exportJson}
      exportCsv={dataPortability.exportCsv}
      previewImportFile={dataPortability.previewImportFile}
      importSummary={importSummary}
      confirmImport={dataPortability.confirmImport}
      restoreBackup={dataPortability.restoreBackup}
      loadDemoData={loadDemoData}
    />
  );
}
