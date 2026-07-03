import { nowIso } from "./appModel";
import { loginToSyncServer } from "./sync";
import type { SetSyncStatus, SyncCommandRuntimeOptions, SyncConnectionCommands } from "./syncCommandTypes";
import type { SyncState } from "./types";

type SyncConnectionCommandOptions = Pick<
  SyncCommandRuntimeOptions,
  "getState" | "getSyncPassword" | "updateState" | "setToast"
> & {
  setSyncStatus: SetSyncStatus;
};

export function createSyncConnectionCommands({
  getState,
  getSyncPassword,
  updateState,
  setSyncStatus,
  setToast,
}: SyncConnectionCommandOptions): SyncConnectionCommands {
  const updateSyncSetting = <K extends keyof SyncState>(key: K, value: SyncState[K]) => {
    updateState((current) => ({
      ...current,
      sync: { ...current.sync, [key]: value },
      updatedAt: nowIso(),
    }));
  };

  const handleSyncLogin = async () => {
    const source = getState();
    if (!source) return;
    setSyncStatus({ status: "authenticating", message: "正在登录团队后台" });
    try {
      const nextSync = await loginToSyncServer(source.sync, getSyncPassword());
      updateState((current) => ({
        ...current,
        sync: nextSync,
        updatedAt: nowIso(),
      }));
      setToast("团队后台已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录团队后台失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const checkSyncHealth = async () => {
    const source = getState();
    if (!source) return;
    setSyncStatus({ status: "syncing", message: "正在检查团队后台健康状态" });
    try {
      const healthUrl = new URL("/health", source.sync.serverUrl.endsWith("/") ? source.sync.serverUrl : `${source.sync.serverUrl}/`).toString();
      const response = await fetch(healthUrl);
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      setSyncStatus({ status: source.sync.token ? "synced" : "idle", message: `团队后台可访问：${healthUrl}` });
      setToast("团队后台健康检查通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "团队后台健康检查失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  return {
    updateSyncSetting,
    checkSyncHealth,
    handleSyncLogin,
  };
}
