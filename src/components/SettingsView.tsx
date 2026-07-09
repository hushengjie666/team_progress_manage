import { SettingsMembersSection } from "./settings/SettingsMembersSection";
import { SettingsDemoPanel } from "./settings/SettingsDemoPanel";
import { effectiveSettingsSection, SettingsSectionTabs } from "./settings/SettingsSectionTabs";
import { SettingsTeamBackendPanel } from "./settings/SettingsTeamBackendPanel";
import { SettingsTimerPanel } from "./settings/SettingsTimerPanel";
import type { SettingsViewProps } from "./settings/settingsViewTypes";

export function SettingsView(props: SettingsViewProps) {
  const {
    projectMembers,
    accounts,
    settings,
    dailyGoal,
    backend,
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
    backendPassword,
    setBackendPassword,
    updateBackendSetting,
    checkBackendHealth,
    handleBackendLogin,
    handleBackendRefresh,
    backendDiagnostic,
    loadDemoData,
  } = props;
  const effectiveSection = effectiveSettingsSection(activeSection, canManageMembers);

  return (
    <div className="settings-layout">
      <section className="band settings-hub">
        <div>
          <p className="eyebrow">管理中心</p>
          <h2>成员库、偏好与系统能力</h2>
          <p className="muted compact-copy">工作区和项目已经移到“工作区”主菜单，这里只保留平台成员库、个人计时、团队后台和演示数据。</p>
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

      {effectiveSection === "backend" && (
        <SettingsTeamBackendPanel
          settings={settings}
          backend={backend}
          backendPassword={backendPassword}
          setBackendPassword={setBackendPassword}
          updateSettings={updateSettings}
          updateBackendSetting={updateBackendSetting}
          checkBackendHealth={checkBackendHealth}
          handleBackendLogin={handleBackendLogin}
          handleBackendRefresh={handleBackendRefresh}
          backendDiagnostic={backendDiagnostic}
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
