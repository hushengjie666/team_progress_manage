import { applyTeamStateLoadFailure } from "./appBoot";
import { nowIso } from "./appModel";
import type { SetBackendConnectionStatus, BackendCommandRuntimeOptions, BackendDataCommands } from "./teamBackendCommandTypes";
import { runBackendDiagnostics as runBackendDiagnosticsApi } from "./teamBackendDiagnostics";
import { loadTeamData } from "./teamBusinessApi";

type BackendDataCommandOptions = Pick<
  BackendCommandRuntimeOptions,
  "getState" | "getBackendPassword" | "setState" | "setToast" | "setBackendDiagnostic"
> & {
  setBackendConnectionStatus: SetBackendConnectionStatus;
};

export function createBackendDataCommands({
  getState,
  getBackendPassword,
  setState,
  setBackendConnectionStatus,
  setToast,
  setBackendDiagnostic,
}: BackendDataCommandOptions): BackendDataCommands {
  const handleBackendRefresh = async () => {
    const current = getState();
    const token = current?.auth.token ?? current?.backend.token;
    if (!current || !token) {
      setToast("请先登录团队后台");
      return;
    }
    setBackendConnectionStatus({ status: "loading", message: "正在刷新团队在线数据" });
    try {
      const next = await loadTeamData(current);
      setState(next);
      setToast("团队在线数据已刷新");
    } catch (error) {
      const failed = applyTeamStateLoadFailure(current, error);
      setState(failed);
      setToast(failed.backend.message);
    }
  };

  const runBackendDiagnostics = async () => {
    const source = getState();
    if (!source) return;
    setBackendConnectionStatus({ status: "loading", message: "正在运行后台诊断" });
    try {
      const { result, state: diagnosedState } = await runBackendDiagnosticsApi(source, getBackendPassword());
      setBackendDiagnostic(result);
      setState(diagnosedState);
      setToast(result.lastError ? `诊断完成：${result.lastError}` : "后台诊断通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "后台诊断失败";
      setBackendDiagnostic({
        checkedAt: nowIso(),
        serverUrl: source.backend.serverUrl,
        lastError: message,
        steps: [],
      });
      setBackendConnectionStatus({ status: "error", message });
      setToast(message);
    }
  };

  return {
    handleBackendRefresh,
    runBackendDiagnostics,
  };
}
