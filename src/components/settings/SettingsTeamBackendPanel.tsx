import { Cloud } from "lucide-react";
import type { Settings, BackendDiagnosticResult, BackendConnectionState } from "../../types";
import { SettingsTeamBackendAdvancedPanel, SettingsTeamBackendAdvancedToggle } from "./SettingsTeamBackendAdvancedPanel";
import { SettingsTeamBackendConnectionPanel } from "./SettingsTeamBackendConnectionPanel";
import { SettingsTeamBackendStatusPanel } from "./SettingsTeamBackendStatusPanel";
import type { SettingsDataSummary } from "./settingsTypes";

export function SettingsTeamBackendPanel({
  settings,
  backend,
  backendPassword,
  setBackendPassword,
  updateSettings,
  updateBackendSetting,
  checkBackendHealth,
  handleBackendLogin,
  handleBackendRefresh,
  runBackendDiagnostics,
  backendDiagnostic,
  dataSummary,
  projectCount,
  projectMemberCount,
}: {
  settings: Pick<Settings, "advancedBackendVisible">;
  backend: BackendConnectionState;
  backendPassword: string;
  setBackendPassword: (value: string) => void;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
  updateBackendSetting: <K extends keyof BackendConnectionState>(key: K, value: BackendConnectionState[K]) => void;
  checkBackendHealth: () => Promise<void>;
  handleBackendLogin: () => Promise<void>;
  handleBackendRefresh: () => Promise<void>;
  runBackendDiagnostics: () => Promise<void>;
  backendDiagnostic: BackendDiagnosticResult | null;
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
      <SettingsTeamBackendStatusPanel backend={backend} />
      <SettingsTeamBackendConnectionPanel
        backend={backend}
        backendPassword={backendPassword}
        setBackendPassword={setBackendPassword}
        updateBackendSetting={updateBackendSetting}
        checkBackendHealth={checkBackendHealth}
        handleBackendLogin={handleBackendLogin}
        handleBackendRefresh={handleBackendRefresh}
        runBackendDiagnostics={runBackendDiagnostics}
      />
      <p className="muted">{backend.message}</p>
      <SettingsTeamBackendAdvancedPanel
        visible={Boolean(settings.advancedBackendVisible)}
        backend={backend}
        backendDiagnostic={backendDiagnostic}
        dataSummary={dataSummary}
        projectCount={projectCount}
        projectMemberCount={projectMemberCount}
      />
      <SettingsTeamBackendAdvancedToggle settings={settings} updateSettings={updateSettings} />
    </section>
  );
}
