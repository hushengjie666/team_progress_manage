import type { AppState, SyncDiagnosticResult, SyncDiagnosticStep } from "./types";
import {
  runHealthDiagnosticStep,
  runLoginDiagnosticStep,
} from "./syncDiagnosticConnectionSteps";
import {
  runPullDiagnosticStep,
  runPushDiagnosticStep,
  unauthenticatedTeamDiagnosticSteps,
} from "./syncDiagnosticTeamSteps";

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
    proxy: [`反向代理到 ${normalized}，建议开启 HTTPS，并把 MySQL 数据库和后台配置加入服务器备份。`],
    storage: "团队后台使用 MySQL 存储；请在 sync.json 中配置 mysql_dsn，并定期备份 timemanage_sync 数据库。",
  };
};

export async function runSyncDiagnostics(state: AppState, password?: string): Promise<{ result: SyncDiagnosticResult; state: AppState }> {
  const checkedAt = new Date().toISOString();
  const steps: SyncDiagnosticStep[] = [];
  let workingState = state;
  let lastError: string | undefined;

  const health = await runHealthDiagnosticStep(state);
  steps.push(health.step);
  lastError = health.lastError ?? lastError;

  const login = await runLoginDiagnosticStep(state, workingState, password);
  steps.push(login.step);
  workingState = login.state ?? workingState;
  lastError = login.lastError ?? lastError;

  const token = workingState.auth.token ?? workingState.sync.token;
  if (token) {
    const push = await runPushDiagnosticStep(workingState, token);
    steps.push(push.step);
    lastError = push.lastError ?? lastError;

    const pull = await runPullDiagnosticStep(workingState);
    steps.push(pull.step);
    workingState = pull.state ?? workingState;
    lastError = pull.lastError ?? lastError;
  } else {
    steps.push(...unauthenticatedTeamDiagnosticSteps());
  }

  return {
    state: workingState,
    result: {
      checkedAt,
      serverUrl: state.sync.serverUrl,
      remoteRevision: workingState.sync.lastPulledRevision,
      lastError,
      steps,
    },
  };
}
