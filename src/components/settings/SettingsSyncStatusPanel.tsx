import type { SyncState } from "../../types";

const syncStatusLabel = (sync: SyncState) => (
  sync.status === "synced"
    ? "已同步"
    : sync.status === "syncing"
      ? "同步中"
      : sync.status === "authenticating"
        ? "登录中"
        : sync.status === "error"
          ? "异常"
          : sync.token
            ? "已登录"
            : "未登录"
);

export function SettingsSyncStatusPanel({ sync }: { sync: SyncState }) {
  return (
    <>
      <div className="sync-summary-grid">
        <div>
          <span>当前状态</span>
          <strong>{syncStatusLabel(sync)}</strong>
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
      </div>
    </>
  );
}
