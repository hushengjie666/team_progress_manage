import { deploymentCommands } from "../../teamBackendDiagnostics";
import type { Settings, BackendDiagnosticResult, BackendConnectionState } from "../../types";
import type { SettingsDataSummary } from "./settingsTypes";

export function SettingsTeamBackendAdvancedPanel({
  visible,
  backend,
  backendDiagnostic,
  dataSummary,
  projectCount,
  projectMemberCount,
}: {
  visible: boolean;
  backend: BackendConnectionState;
  backendDiagnostic: BackendDiagnosticResult | null;
  dataSummary: SettingsDataSummary;
  projectCount: number;
  projectMemberCount: number;
}) {
  const commands = deploymentCommands(backend.serverUrl);

  return (
    <>
      {backendDiagnostic && (
        <div className="diagnostic-panel">
          <strong>诊断结果：{new Date(backendDiagnostic.checkedAt).toLocaleString()}</strong>
          {backendDiagnostic.steps.map((step) => (
            <article className={step.ok ? "diagnostic-step ok" : "diagnostic-step"} key={step.id}>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
              {step.latencyMs !== undefined && <small>{step.latencyMs}ms</small>}
            </article>
          ))}
        </div>
      )}
      {visible && (
        <div className="deploy-helper">
          <div className="section-title compact-title">
            <div>
              <p className="eyebrow">部署提示</p>
              <h2>自建服务器部署提示</h2>
            </div>
          </div>
          <div className="deploy-grid">
            <DeployBlock title="Linux" commands={commands.linux} />
            <DeployBlock title="Windows" commands={commands.windows} />
          </div>
          <p className="muted">{commands.proxy[0]}</p>
          <p className="muted">{commands.storage}</p>
        </div>
      )}
      {visible && (
        <div className="backend-table">
          <span>项目</span>
          <strong>{projectCount}</strong>
          <span>成员</span>
          <strong>{projectMemberCount}</strong>
          <span>任务</span>
          <strong>{dataSummary.taskCount}</strong>
          <span>工作会话</span>
          <strong>{dataSummary.workSessionCount}</strong>
          <span>执行信号</span>
          <strong>{dataSummary.executionSignalCount}</strong>
          <span>番茄记录</span>
          <strong>{dataSummary.focusSessionCount}</strong>
          <span>中断</span>
          <strong>{dataSummary.interruptionCount}</strong>
          <span>上次刷新</span>
          <strong>{backend.lastLoadedAt ? new Date(backend.lastLoadedAt).toLocaleTimeString() : "未刷新"}</strong>
        </div>
      )}
    </>
  );
}

export function SettingsTeamBackendAdvancedToggle({
  settings,
  updateSettings,
}: {
  settings: Pick<Settings, "advancedBackendVisible">;
  updateSettings: <K extends keyof Settings>(key: K, value: Settings[K]) => void;
}) {
  return (
    <button className="link-button" onClick={() => updateSettings("advancedBackendVisible", !settings.advancedBackendVisible)}>
      {settings.advancedBackendVisible ? "收起高级状态" : "展开高级状态"}
    </button>
  );
}

function DeployBlock({ title, commands }: { title: string; commands: string[] }) {
  return (
    <article className="deploy-block">
      <strong>{title}</strong>
      {commands.map((command) => (
        <code key={command}>{command}</code>
      ))}
    </article>
  );
}
