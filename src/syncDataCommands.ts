import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan, nowIso } from "./appModel";
import type { SetSyncStatus, SyncCommandRuntimeOptions, SyncDataCommands } from "./syncCommandTypes";
import { runSyncDiagnostics as runSyncDiagnosticsApi } from "./syncDiagnostics";
import { loadTeamState } from "./teamApi";

type SyncDataCommandOptions = Pick<
  SyncCommandRuntimeOptions,
  "getState" | "getSyncPassword" | "setState" | "setToast" | "setSyncDiagnostic"
> & {
  setSyncStatus: SetSyncStatus;
};

export function createSyncDataCommands({
  getState,
  getSyncPassword,
  setState,
  setSyncStatus,
  setToast,
  setSyncDiagnostic,
}: SyncDataCommandOptions): SyncDataCommands {
  const handleSyncNow = async () => {
    const current = getState();
    const token = current?.auth.token ?? current?.sync.token;
    if (!current || !token) {
      setToast("请先登录团队后台");
      return;
    }
    setSyncStatus({ status: "syncing", message: "正在刷新团队在线数据" });
    try {
      const next = ensureTodayPlan(await loadTeamState(current));
      setState(next);
      setToast("团队在线数据已刷新");
    } catch (error) {
      const failed = applyTeamStateLoadFailure(current, error);
      setState(failed);
      setToast(failed.auth.message);
    }
  };

  const runSyncDiagnostics = async () => {
    const source = getState();
    if (!source) return;
    setSyncStatus({ status: "syncing", message: "正在运行后台诊断" });
    try {
      const { result, state: diagnosedState } = await runSyncDiagnosticsApi(source, getSyncPassword());
      setSyncDiagnostic(result);
      setState(ensureTodayPlan(diagnosedState));
      setToast(result.lastError ? `诊断完成：${result.lastError}` : "后台诊断通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "后台诊断失败";
      setSyncDiagnostic({
        checkedAt: nowIso(),
        serverUrl: source.sync.serverUrl,
        lastError: message,
        steps: [],
      });
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  return {
    handleSyncNow,
    runSyncDiagnostics,
  };
}
