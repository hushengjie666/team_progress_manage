import { Cloud, LogIn, RefreshCw, Server } from "lucide-react";
import type { SyncState } from "../../types";

const syncActionStatusLabel = (status: SyncState["status"]) => (
  status === "synced"
    ? "已同步"
    : status === "syncing"
      ? "刷新中"
      : status === "authenticating"
        ? "登录中"
        : status === "error"
          ? "异常"
          : "待连接"
);

export function SettingsSyncConnectionPanel({
  sync,
  syncPassword,
  setSyncPassword,
  updateSyncSetting,
  checkSyncHealth,
  handleSyncLogin,
  handleSyncNow,
  runSyncDiagnostics,
}: {
  sync: SyncState;
  syncPassword: string;
  setSyncPassword: (value: string) => void;
  updateSyncSetting: <K extends keyof SyncState>(key: K, value: SyncState[K]) => void;
  checkSyncHealth: () => Promise<void>;
  handleSyncLogin: () => Promise<void>;
  handleSyncNow: () => Promise<void>;
  runSyncDiagnostics: () => Promise<void>;
}) {
  return (
    <>
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
          刷新在线数据
        </button>
        <button className="secondary-button" onClick={() => void runSyncDiagnostics()}>
          <Server size={16} />
          运行后台诊断
        </button>
        <span className={`sync-status sync-status-${sync.status}`}>
          {syncActionStatusLabel(sync.status)}
        </span>
      </div>
    </>
  );
}
