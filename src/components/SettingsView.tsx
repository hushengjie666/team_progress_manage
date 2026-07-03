import { SettingsMembersSection } from "./settings/SettingsMembersSection";
import { SettingsDataPanel } from "./settings/SettingsDataPanel";
import { SettingsDemoPanel } from "./settings/SettingsDemoPanel";
import { effectiveSettingsSection, SettingsSectionTabs } from "./settings/SettingsSectionTabs";
import { SettingsSyncPanel } from "./settings/SettingsSyncPanel";
import { SettingsTimerPanel } from "./settings/SettingsTimerPanel";
import type { SettingsViewProps } from "./settings/settingsViewTypes";

export function SettingsView(props: SettingsViewProps) {
  const {
    projectMembers,
    accounts,
    settings,
    dailyGoal,
    sync,
    backupSnapshots,
    dataSummary,
    activeSection,
    setActiveSection,
    updateSettings,
    createAccount,
    updateAccount,
    updateAccountPassword,
    disableAccount,
    canManageMembers = true,
    askNotificationPermissions,
    syncPassword,
    setSyncPassword,
    updateSyncSetting,
    checkSyncHealth,
    handleSyncLogin,
    handleSyncNow,
    runSyncDiagnostics,
    syncDiagnostic,
    exportJson,
    exportCsv,
    previewImportFile,
    importSummary,
    confirmImport,
    restoreBackup,
    loadDemoData,
  } = props;
  const effectiveSection = effectiveSettingsSection(activeSection, canManageMembers);

  return (
    <div className="settings-layout">
      <section className="band settings-hub">
        <div>
          <p className="eyebrow">管理中心</p>
          <h2>成员库、偏好与系统能力</h2>
          <p className="muted compact-copy">工作区和项目已经移到“工作区”主菜单，这里只保留平台成员库、个人计时、同步和备份。</p>
        </div>
        <SettingsSectionTabs
          activeSection={activeSection}
          canManageMembers={canManageMembers}
          setActiveSection={setActiveSection}
        />
      </section>

      {effectiveSection === "members" && (
        <SettingsMembersSection
          accounts={accounts}
          projectMembers={projectMembers}
          createAccount={createAccount}
          updateAccount={updateAccount}
          updateAccountPassword={updateAccountPassword}
          disableAccount={disableAccount}
        />
      )}

      {effectiveSection === "timer" && (
        <SettingsTimerPanel
          dailyGoal={dailyGoal}
          settings={settings}
          updateSettings={updateSettings}
          askNotificationPermissions={askNotificationPermissions}
        />
      )}

      {effectiveSection === "data" && (
        <SettingsDataPanel
          backupSnapshots={backupSnapshots}
          exportJson={exportJson}
          exportCsv={exportCsv}
          previewImportFile={previewImportFile}
          importSummary={importSummary}
          confirmImport={confirmImport}
          restoreBackup={restoreBackup}
        />
      )}

      {effectiveSection === "sync" && (
        <SettingsSyncPanel
          settings={settings}
          sync={sync}
          syncPassword={syncPassword}
          setSyncPassword={setSyncPassword}
          updateSettings={updateSettings}
          updateSyncSetting={updateSyncSetting}
          checkSyncHealth={checkSyncHealth}
          handleSyncLogin={handleSyncLogin}
          handleSyncNow={handleSyncNow}
          runSyncDiagnostics={runSyncDiagnostics}
          syncDiagnostic={syncDiagnostic}
          dataSummary={dataSummary}
          projectCount={dataSummary.projectCount}
          projectMemberCount={projectMembers.length}
        />
      )}

      {effectiveSection === "demo" && (
        <SettingsDemoPanel
          projectCount={dataSummary.projectCount}
          taskCount={dataSummary.taskCount}
          projectMemberCount={projectMembers.length}
          workRecordCount={dataSummary.focusSessionCount + dataSummary.workSessionCount}
          loadDemoData={loadDemoData}
        />
      )}
    </div>
  );
}
