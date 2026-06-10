import { flattenStateToChanges, loginToSyncServer, syncAppState } from "./sync";
import type { AppState, SyncDiagnosticResult, SyncDiagnosticStep } from "./types";

const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

const timed = async <T>(runner: () => Promise<T>) => {
  const start = performance.now();
  const result = await runner();
  return { result, latencyMs: Math.round(performance.now() - start) };
};

export const deploymentCommands = (serverUrl: string) => {
  const normalized = serverUrl.replace(/\/+$/, "");
  return {
    linux: [
      "chmod +x timemanage-sync-linux-amd64",
      "./timemanage-sync-linux-amd64 serve --config /opt/timemanage/sync.json",
      "sudo ./install-linux-service.sh",
      "sudo systemctl enable --now timemanage-sync",
    ],
    windows: [
      ".\\timemanage-sync.exe serve --config C:\\TimeManage\\sync.json",
      ".\\timemanage-sync.exe install --config C:\\TimeManage\\sync.json",
      ".\\timemanage-sync.exe start",
    ],
    proxy: [`反向代理到 ${normalized}，建议开启 HTTPS，并把数据文件目录加入服务器备份。`],
    dataPath: "默认数据文件：sync-server/data/sync.db；服务器建议放到 /var/lib/timemanage 或 C:\\TimeManage\\data。",
  };
};

export async function runSyncDiagnostics(state: AppState, password?: string): Promise<{ result: SyncDiagnosticResult; state: AppState }> {
  const checkedAt = new Date().toISOString();
  const steps: SyncDiagnosticStep[] = [];
  let workingState = state;
  let lastError: string | undefined;

  try {
    const { latencyMs } = await timed(async () => {
      const response = await fetch(apiUrl(state.sync.serverUrl, "/health"));
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      return response.text();
    });
    steps.push({ id: "health", label: "健康检查", ok: true, latencyMs, detail: "同步服务 /health 可访问。" });
  } catch (error) {
    lastError = error instanceof Error ? error.message : "健康检查失败";
    steps.push({ id: "health", label: "健康检查", ok: false, detail: lastError });
  }

  if (password && state.sync.username) {
    try {
      const loginResult = await timed(() => loginToSyncServer(workingState.sync, password));
      workingState = { ...workingState, sync: loginResult.result };
      steps.push({ id: "login", label: "登录", ok: true, latencyMs: loginResult.latencyMs, detail: "账号可登录，Token 已刷新。" });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "登录失败";
      steps.push({ id: "login", label: "登录", ok: false, detail: lastError });
    }
  } else {
    steps.push({ id: "login", label: "登录", ok: Boolean(state.sync.token), detail: state.sync.token ? "已有 Token。" : "未提供密码，跳过登录。" });
  }

  if (workingState.sync.token) {
    try {
      const changes = flattenStateToChanges(workingState).length;
      const syncResult = await timed(() => syncAppState(workingState));
      workingState = syncResult.result;
      steps.push({
        id: "push",
        label: "Push",
        ok: true,
        latencyMs: syncResult.latencyMs,
        detail: `已尝试推送 ${changes} 条实体快照。`,
      });
      steps.push({
        id: "pull",
        label: "Pull",
        ok: true,
        latencyMs: syncResult.latencyMs,
        detail: `远端 revision ${workingState.sync.lastPulledRevision}，冲突 ${workingState.sync.conflictCount} 个。`,
      });
    } catch (error) {
      lastError = error instanceof Error ? error.message : "推拉同步失败";
      steps.push({ id: "push", label: "Push", ok: false, detail: lastError });
      steps.push({ id: "pull", label: "Pull", ok: false, detail: "Push 未通过，跳过 Pull 验证。" });
    }
  } else {
    steps.push({ id: "push", label: "Push", ok: false, detail: "未登录，无法推送。" });
    steps.push({ id: "pull", label: "Pull", ok: false, detail: "未登录，无法拉取。" });
  }

  return {
    state: workingState,
    result: {
      checkedAt,
      serverUrl: state.sync.serverUrl,
      remoteRevision: workingState.sync.lastPulledRevision,
      conflictCount: workingState.sync.conflictCount,
      lastError,
      steps,
    },
  };
}
