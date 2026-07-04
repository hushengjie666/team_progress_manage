import { nowIso } from "./appModel";
import { loginToBackend } from "./teamBackend";
import type { SetBackendConnectionStatus, BackendCommandRuntimeOptions, BackendConnectionCommands } from "./teamBackendCommandTypes";
import type { BackendConnectionState } from "./types";

type BackendConnectionCommandOptions = Pick<
  BackendCommandRuntimeOptions,
  "getState" | "getBackendPassword" | "updateState" | "setToast"
> & {
  setBackendConnectionStatus: SetBackendConnectionStatus;
};

export function createBackendConnectionCommands({
  getState,
  getBackendPassword,
  updateState,
  setBackendConnectionStatus,
  setToast,
}: BackendConnectionCommandOptions): BackendConnectionCommands {
  const updateBackendSetting = <K extends keyof BackendConnectionState>(key: K, value: BackendConnectionState[K]) => {
    updateState((current) => ({
      ...current,
      backend: { ...current.backend, [key]: value },
      updatedAt: nowIso(),
    }));
  };

  const handleBackendLogin = async () => {
    const source = getState();
    if (!source) return;
    setBackendConnectionStatus({ status: "authenticating", message: "正在登录团队后台" });
    try {
      const nextBackend = await loginToBackend(source.backend, getBackendPassword());
      updateState((current) => ({
        ...current,
        backend: nextBackend,
        updatedAt: nowIso(),
      }));
      setToast("团队后台已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录团队后台失败";
      setBackendConnectionStatus({ status: "error", message });
      setToast(message);
    }
  };

  const checkBackendHealth = async () => {
    const source = getState();
    if (!source) return;
    setBackendConnectionStatus({ status: "loading", message: "正在检查团队后台健康状态" });
    try {
      const healthUrl = new URL("/health", source.backend.serverUrl.endsWith("/") ? source.backend.serverUrl : `${source.backend.serverUrl}/`).toString();
      const response = await fetch(healthUrl);
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      setBackendConnectionStatus({ status: source.backend.token ? "ready" : "idle", message: `团队后台可访问：${healthUrl}` });
      setToast("团队后台健康检查通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "团队后台健康检查失败";
      setBackendConnectionStatus({ status: "error", message });
      setToast(message);
    }
  };

  return {
    updateBackendSetting,
    checkBackendHealth,
    handleBackendLogin,
  };
}
