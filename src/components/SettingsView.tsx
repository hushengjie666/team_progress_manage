import type {
  BackupSnapshot,
  BlockProfile,
  Account,
  ImportSummary,
  NativeCapabilityState,
  Onboarding,
  ProjectMember,
  Settings,
  StrictModeStatus,
  SyncConflict,
  SyncDiagnosticResult,
  SyncState,
} from "../types";
import { SettingsMembersSection } from "./settings/SettingsMembersSection";
import { SettingsDataPanel } from "./settings/SettingsDataPanel";
import { SettingsDemoPanel } from "./settings/SettingsDemoPanel";
import { SettingsSyncPanel } from "./settings/SettingsSyncPanel";
import { SettingsSystemPanel } from "./settings/SettingsSystemPanel";
import { SettingsTimerPanel } from "./settings/SettingsTimerPanel";
import { SettingsFocusPanel } from "./settings/SettingsFocusPanel";

export type SettingsSection = "members" | "timer" | "focus" | "sync" | "data" | "system" | "demo";

export type SettingsDataSummary = {
  projectCount: number;
  taskCount: number;
  projectMemberCount: number;
  focusSessionCount: number;
  workSessionCount: number;
  executionSignalCount: number;
  interruptionCount: number;
};

export function SettingsView(props: {
  projectMembers: ProjectMember[];
  accounts: Account[];
  settings: Settings;
  onboarding: Pick<Onboarding, "dailyGoalPomodoros" | "preferredFocusMinutes">;
  sync: SyncState;
  backupSnapshots: BackupSnapshot[];
  nativeCapabilities: NativeCapabilityState[];
  dataSummary: SettingsDataSummary;
  activeSection: SettingsSection;
  setActiveSection: (section: SettingsSection) => void;
  activeProfile?: BlockProfile;
  strictStatus: StrictModeStatus | null;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  createAccount: (name: string, email: string, password?: string) => void;
  updateAccount: (account: Account) => void;
  updateAccountPassword: (account: Account, password: string) => void;
  disableAccount: (accountId: string) => void;
  canManageMembers?: boolean;
  updateProfile: (profile: BlockProfile) => void;
  askPermissions: () => Promise<void>;
  askNotificationPermissions: () => Promise<void>;
  syncPassword: string;
  setSyncPassword: (value: string) => void;
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
  syncDiagnostic: SyncDiagnosticResult | null;
  exportJson: () => void;
  exportCsv: () => void;
  previewImportFile: (file: File) => Promise<void>;
  importSummary: ImportSummary | null;
  confirmImport: () => void;
  restoreBackup: (backupId: string) => void;
  resolveSyncConflict: (conflict: SyncConflict, action: "local" | "remote" | "later") => void;
  loadDemoData: () => void;
}) {
  const {
    projectMembers,
    accounts,
    settings,
    onboarding,
    sync,
    backupSnapshots,
    nativeCapabilities,
    dataSummary,
    activeSection,
    setActiveSection,
    activeProfile,
    strictStatus,
    updateSettings,
    createAccount,
    updateAccount,
    updateAccountPassword,
    disableAccount,
    canManageMembers = true,
    updateProfile,
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
    resolveSyncConflict,
    loadDemoData,
  } = props;
  const effectiveSection = !canManageMembers && activeSection === "members" ? "sync" : activeSection;
  const allSections: { key: SettingsSection; label: string }[] = [
    { key: "members", label: "成员管理" },
    { key: "timer", label: "计时偏好" },
    { key: "focus", label: "防分心" },
    { key: "sync", label: "团队后台" },
    { key: "data", label: "备份恢复" },
    { key: "system", label: "系统环境" },
    { key: "demo", label: "演示数据" },
  ];
  const sectionNav = allSections.filter((section) => canManageMembers || section.key !== "members");

  return (
    <div className="settings-layout">
      <section className="band settings-hub">
        <div>
          <p className="eyebrow">管理中心</p>
          <h2>成员库、偏好与系统能力</h2>
          <p className="muted compact-copy">工作区和项目已经移到“工作区”主菜单，这里只保留平台成员库、个人计时、同步和备份。</p>
        </div>
        <div className="segmented settings-section-tabs">
          {sectionNav.map((section) => (
            <button
              className={effectiveSection === section.key ? "active" : ""}
              key={section.key}
              onClick={() => setActiveSection(section.key)}
            >
              {section.label}
            </button>
          ))}
        </div>
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
          onboarding={onboarding}
          settings={settings}
          updateSettings={updateSettings}
          askNotificationPermissions={askNotificationPermissions}
        />
      )}

      {effectiveSection === "focus" && (
        <SettingsFocusPanel
          activeProfile={activeProfile}
          strictStatus={strictStatus}
          updateProfile={updateProfile}
          askPermissions={props.askPermissions}
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
          resolveSyncConflict={resolveSyncConflict}
        />
      )}

      {effectiveSection === "system" && <SettingsSystemPanel nativeCapabilities={nativeCapabilities} />}

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
