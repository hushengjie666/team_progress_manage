import { Cloud, LogIn, RefreshCw, Server } from "lucide-react";
import type { BackendConnectionState } from "../../types";

const backendActionStatusLabel = (status: BackendConnectionState["status"]) => (
  status === "ready"
    ? "已刷新"
    : status === "loading"
      ? "读取中"
    : status === "saving"
      ? "保存中"
      : status === "authenticating"
        ? "登录中"
        : status === "error"
          ? "异常"
          : "待连接"
);

export function SettingsTeamBackendConnectionPanel({
  backend,
  backendPassword,
  setBackendPassword,
  updateBackendSetting,
  checkBackendHealth,
  handleBackendLogin,
  handleBackendRefresh,
  runBackendDiagnostics,
}: {
  backend: BackendConnectionState;
  backendPassword: string;
  setBackendPassword: (value: string) => void;
  updateBackendSetting: <K extends keyof BackendConnectionState>(key: K, value: BackendConnectionState[K]) => void;
  checkBackendHealth: () => Promise<void>;
  handleBackendLogin: () => Promise<void>;
  handleBackendRefresh: () => Promise<void>;
  runBackendDiagnostics: () => Promise<void>;
}) {
  return (
    <>
      <div className="backend-grid">
        <label>
          服务地址
          <input
            value={backend.serverUrl}
            onChange={(event) => updateBackendSetting("serverUrl", event.target.value)}
            placeholder="http://127.0.0.1:8787"
          />
        </label>
        <label>
          账号
          <input value={backend.username} onChange={(event) => updateBackendSetting("username", event.target.value)} />
        </label>
        <label>
          密码
          <input type="password" value={backendPassword} onChange={(event) => setBackendPassword(event.target.value)} />
        </label>
      </div>
      <div className="backend-actions">
        <button
          className="secondary-button"
          disabled={backend.status === "loading" || backend.status === "saving"}
          onClick={() => void checkBackendHealth()}
        >
          <Cloud size={16} />
          检查服务
        </button>
        <button
          className="primary-button"
          disabled={backend.status === "authenticating"}
          onClick={() => void handleBackendLogin()}
        >
          <LogIn size={16} />
          登录团队后台
        </button>
        <button
          className="secondary-button"
          disabled={!backend.token || backend.status === "loading" || backend.status === "saving"}
          onClick={() => void handleBackendRefresh()}
        >
          <RefreshCw size={16} />
          刷新在线数据
        </button>
        <button className="secondary-button" onClick={() => void runBackendDiagnostics()}>
          <Server size={16} />
          运行后台诊断
        </button>
        <span className={`backend-status backend-status-${backend.status}`}>
          {backendActionStatusLabel(backend.status)}
        </span>
      </div>
    </>
  );
}
