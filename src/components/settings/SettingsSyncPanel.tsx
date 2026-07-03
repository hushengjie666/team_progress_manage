import { Cloud } from "lucide-react";
import type { Settings, SyncDiagnosticResult, SyncState } from "../../types";
import { SettingsSyncAdvancedPanel, SettingsSyncAdvancedToggle } from "./SettingsSyncAdvancedPanel";
import { SettingsSyncConnectionPanel } from "./SettingsSyncConnectionPanel";
import { SettingsSyncStatusPanel } from "./SettingsSyncStatusPanel";
import type { SettingsDataSummary } from "./settingsTypes";

export function SettingsSyncPanel({
  settings,
  sync,
  syncPassword,
  setSyncPassword,
  updateSettings,
  updateSyncSetting,
  checkSyncHealth,
  handleSyncLogin,
  handleSyncNow,
  runSyncDiagnostics,
  syncDiagnostic,
  dataSummary,
  projectCount,
  projectMemberCount,
}: {
  settings: Pick<Settings, "advancedSyncVisible">;
  sync: SyncState;
  syncPassword: string;
  setSyncPassword: (value: string) => void;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
  syncDiagnostic: SyncDiagnosticResult | null;
  dataSummary: SettingsDataSummary;
  projectCount: number;
  projectMemberCount: number;
}) {
  return (
    <section className="band settings-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">团队后台</p>
          <h2>团队后台状态</h2>
        </div>
        <Cloud size={20} />
      </div>
      <SettingsSyncStatusPanel sync={sync} />
      <SettingsSyncConnectionPanel
        sync={sync}
        syncPassword={syncPassword}
        setSyncPassword={setSyncPassword}
        updateSyncSetting={updateSyncSetting}
        checkSyncHealth={checkSyncHealth}
        handleSyncLogin={handleSyncLogin}
        handleSyncNow={handleSyncNow}
        runSyncDiagnostics={runSyncDiagnostics}
      />
      <p className="muted">{sync.message}</p>
      <SettingsSyncAdvancedPanel
        visible={Boolean(settings.advancedSyncVisible)}
        sync={sync}
        syncDiagnostic={syncDiagnostic}
        dataSummary={dataSummary}
        projectCount={projectCount}
        projectMemberCount={projectMemberCount}
      />
      <SettingsSyncAdvancedToggle settings={settings} updateSettings={updateSettings} />
    </section>
  );
}
