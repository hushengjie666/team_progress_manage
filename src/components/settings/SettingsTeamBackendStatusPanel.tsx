import type { BackendConnectionState } from "../../types";

const backendStatusLabel = (backend: BackendConnectionState) => (
  backend.status === "ready"
    ? "已刷新"
    : backend.status === "loading"
      ? "读取中"
    : backend.status === "saving"
      ? "保存中"
      : backend.status === "authenticating"
        ? "登录中"
        : backend.status === "error"
          ? "异常"
          : backend.token
            ? "已登录"
            : "未登录"
);

export function SettingsTeamBackendStatusPanel({ backend }: { backend: BackendConnectionState }) {
  return (
    <>
      <div className="backend-summary-grid">
        <div>
          <span>当前状态</span>
          <strong>{backendStatusLabel(backend)}</strong>
        </div>
        <div>
          <span>服务地址</span>
          <strong>{backend.serverUrl.replace(/^https?:\/\//, "")}</strong>
        </div>
        <div>
          <span>数据来源</span>
          <strong>团队后台</strong>
        </div>
        <div>
          <span>上次刷新</span>
          <strong>{backend.lastLoadedAt ? new Date(backend.lastLoadedAt).toLocaleTimeString() : "未刷新"}</strong>
        </div>
      </div>
      <div className="backend-steps">
        <span className="active">1 服务地址</span>
        <span className={backend.status !== "idle" ? "active" : ""}>2 健康检查</span>
        <span className={backend.token ? "active" : ""}>3 登录</span>
        <span className={backend.lastLoadedAt ? "active" : ""}>4 在线数据</span>
      </div>
    </>
  );
}
