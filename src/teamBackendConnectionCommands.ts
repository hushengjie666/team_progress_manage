import { nowIso } from "./appModel";
import { applyBackendCompatibilityFailure } from "./appBoot";
import { loginToBackend } from "./teamBackend";
import type { SetBackendConnectionStatus, BackendCommandRuntimeOptions, BackendConnectionCommands } from "./teamBackendCommandTypes";
import type { BackendConnectionState } from "./types";
import { checkBackendCompatibility, isTeamBackendCompatibilityError } from "./teamBackendCompatibility";

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
      const compatibility = await checkBackendCompatibility(source.backend.serverUrl);
      setBackendConnectionStatus({
        status: source.backend.token ? "ready" : "idle",
        message: compatibility.message,
        compatibility,
        failureKind: undefined,
      });
      setToast("团队后台健康检查通过");
    } catch (error) {
      if (isTeamBackendCompatibilityError(error)) {
        const failed = applyBackendCompatibilityFailure(source, error);
        updateState(() => failed);
        setToast(failed.backend.message);
        return;
      }
      const message = error instanceof Error ? error.message : "团队后台健康检查失败";
      setBackendConnectionStatus({ status: "error", message, failureKind: "health" });
      setToast(message);
    }
  };

  return {
    updateBackendSetting,
    checkBackendHealth,
    handleBackendLogin,
  };
}
