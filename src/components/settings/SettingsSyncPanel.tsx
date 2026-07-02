import { Cloud, LogIn, RefreshCw, Server } from "lucide-react";
import { deploymentCommands } from "../../syncDiagnostics";
import type { Settings, SyncConflict, SyncDiagnosticResult, SyncState } from "../../types";
import type { SettingsDataSummary } from "../SettingsView";

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
  resolveSyncConflict,
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
  resolveSyncConflict: (conflict: SyncConflict, action: "local" | "remote" | "later") => void;
}) {
  const commands = deploymentCommands(sync.serverUrl);

  return (
    <section className="band settings-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">团队后台</p>
          <h2>团队后台状态</h2>
        </div>
        <Cloud size={20} />
      </div>
      <div className="sync-summary-grid">
        <div>
          <span>当前状态</span>
          <strong>
            {sync.status === "synced"
              ? "已同步"
              : sync.status === "syncing"
                ? "同步中"
                : sync.status === "authenticating"
                  ? "登录中"
                  : sync.status === "error"
                    ? "异常"
                    : sync.token
                      ? "已登录"
                      : "未登录"}
          </strong>
        </div>
        <div>
          <span>服务地址</span>
          <strong>{sync.serverUrl.replace(/^https?:\/\//, "")}</strong>
        </div>
        <div>
          <span>远端版本</span>
          <strong>{sync.lastPulledRevision}</strong>
        </div>
        <div>
          <span>上次同步</span>
          <strong>{sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString() : "未同步"}</strong>
        </div>
      </div>
      <div className="sync-steps">
        <span className="active">1 服务地址</span>
        <span className={sync.status !== "idle" ? "active" : ""}>2 健康检查</span>
        <span className={sync.token ? "active" : ""}>3 登录</span>
        <span className={sync.lastSyncedAt ? "active" : ""}>4 同步</span>
        <span className={sync.autoSync ? "active" : ""}>5 自动同步</span>
      </div>
      <div className="sync-grid">
        <label>
          服务地址
          <input
            value={sync.serverUrl}
            onChange={(event) => updateSyncSetting("serverUrl", event.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
        </label>
        <label>
          账号
          <input value={sync.username} onChange={(event) => updateSyncSetting("username", event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={syncPassword} onChange={(event) => setSyncPassword(event.target.value)} />
        </label>
        <label>
          设备 ID
          <input value={sync.deviceId} onChange={(event) => updateSyncSetting("deviceId", event.target.value)} />
        </label>
      </div>
      <div className="sync-actions">
        <button
          className="secondary-button"
          disabled={sync.status === "syncing"}
          onClick={() => void checkSyncHealth()}
        >
          <Cloud size={16} />
          检查服务
        </button>
        <button
          className="primary-button"
          disabled={sync.status === "authenticating"}
          onClick={() => void handleSyncLogin()}
        >
          <LogIn size={16} />
          登录团队后台
        </button>
        <button
          className="secondary-button"
          disabled={!sync.token || sync.status === "syncing"}
          onClick={() => void handleSyncNow()}
        >
          <RefreshCw size={16} />
          立即同步
        </button>
        <label className="inline-toggle">
          <input
            type="checkbox"
            checked={sync.autoSync}
            onChange={(event) => updateSyncSetting("autoSync", event.target.checked)}
          />
          自动同步
        </label>
        <button className="secondary-button" onClick={() => void runSyncDiagnostics()}>
          <Server size={16} />
          运行后台诊断
        </button>
        <label className="compact-input">
          间隔秒
          <input
            type="number"
            min="30"
            max="3600"
            value={sync.intervalSeconds}
            onChange={(event) => updateSyncSetting("intervalSeconds", Number(event.target.value))}
          />
        </label>
        <span className={`sync-status sync-status-${sync.status}`}>
          {sync.status === "synced"
            ? "已同步"
            : sync.status === "syncing"
              ? "同步中"
              : sync.status === "authenticating"
                ? "登录中"
                : sync.status === "error"
                  ? "异常"
                  : "待连接"}
        </span>
      </div>
      <p className="muted">{sync.message}</p>
      {syncDiagnostic && (
        <div className="diagnostic-panel">
          <strong>诊断结果：{new Date(syncDiagnostic.checkedAt).toLocaleString()}</strong>
          <span>远端 revision {syncDiagnostic.remoteRevision ?? 0} · 冲突 {syncDiagnostic.conflictCount}</span>
          {syncDiagnostic.steps.map((step) => (
            <article className={step.ok ? "diagnostic-step ok" : "diagnostic-step"} key={step.id}>
              <strong>{step.label}</strong>
              <span>{step.detail}</span>
              {step.latencyMs !== undefined && <small>{step.latencyMs}ms</small>}
            </article>
          ))}
        </div>
      )}
      {settings.advancedSyncVisible && <div className="deploy-helper">
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
      </div>}
      <button className="link-button" onClick={() => updateSettings("advancedSyncVisible", !settings.advancedSyncVisible)}>
        {settings.advancedSyncVisible ? "收起高级状态" : "展开高级状态"}
      </button>
      {settings.advancedSyncVisible && (
        <>
          <div className="sync-table">
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
            <span>远端版本</span>
            <strong>{sync.lastPulledRevision}</strong>
            <span>SSE 状态</span>
            <strong>
              {sync.sseStatus === "open"
                ? "已连接"
                : sync.sseStatus === "connecting"
                  ? "连接中"
                  : sync.sseStatus === "error"
                    ? "异常"
                    : "未连接"}
            </strong>
            <span>收到版本</span>
            <strong>{sync.lastReceivedRevision ?? 0}</strong>
            <span>待补推</span>
            <strong>{sync.pendingLocalSync ? "是" : "否"}</strong>
            <span>待补拉</span>
            <strong>{sync.pendingRemoteRevision ?? "无"}</strong>
            <span>触发原因</span>
            <strong>{sync.lastSyncReason ?? "无"}</strong>
            <span>冲突</span>
            <strong>{sync.conflictCount}</strong>
            <span>上次同步</span>
            <strong>{sync.lastSyncedAt ? new Date(sync.lastSyncedAt).toLocaleTimeString() : "未同步"}</strong>
            <span>重试次数</span>
            <strong>{sync.retryCount}</strong>
            <span>下次重试</span>
            <strong>{sync.nextRetryAt ? new Date(sync.nextRetryAt).toLocaleTimeString() : "无"}</strong>
          </div>
          <div className="conflict-list">
            {sync.conflicts.slice(0, 5).map((conflict) => (
              <article className="conflict-item" key={`${conflict.entity}-${conflict.id}-${conflict.revision}`}>
                <strong>
                  {conflict.entity}/{conflict.id}
                </strong>
                <span>远端版本 {conflict.revision}</span>
                <small>
                  本地 {conflict.localUpdatedAt ? new Date(conflict.localUpdatedAt).toLocaleString() : "无"} · 远端{" "}
                  {new Date(conflict.remoteUpdatedAt).toLocaleString()}
                </small>
                {conflict.remotePayload !== undefined && (
                  <details className="conflict-detail">
                    <summary>远端详情</summary>
                    <pre>{JSON.stringify(conflict.remotePayload, null, 2).slice(0, 1200)}</pre>
                  </details>
                )}
                <div className="button-row">
                  <button className="small-button" onClick={() => resolveSyncConflict(conflict, "local")}>保留本地</button>
                  <button className="small-button" onClick={() => resolveSyncConflict(conflict, "remote")}>使用远端</button>
                  <button className="small-button" onClick={() => resolveSyncConflict(conflict, "later")}>稍后处理</button>
                </div>
              </article>
            ))}
            {sync.conflicts.length === 0 && <p className="empty">暂无同步冲突。</p>}
          </div>
        </>
      )}
    </section>
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
