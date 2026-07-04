import type { AppState, BackendDiagnosticResult, BackendDiagnosticStep } from "./types";
import {
  runHealthDiagnosticStep,
  runLoginDiagnosticStep,
} from "./teamBackendDiagnosticConnectionSteps";
import {
  runLoadDiagnosticStep,
  runSaveDiagnosticStep,
  unauthenticatedTeamDiagnosticSteps,
} from "./teamBackendDiagnosticTeamSteps";

export const deploymentCommands = (serverUrl: string) => {
  const normalized = serverUrl.replace(/\/+$/, "");
  return {
    linux: [
      "chmod +x timemanage-team-linux-amd64",
      "./timemanage-team-linux-amd64 serve --config /opt/timemanage/backend.json",
      "sudo ./install-linux-service.sh",
      "sudo systemctl enable --now timemanage-team",
    ],
    windows: [
      ".\\timemanage-team.exe serve --config C:\\TimeManage\\backend.json",
      ".\\timemanage-team.exe install --config C:\\TimeManage\\backend.json",
      ".\\timemanage-team.exe start",
    ],
    proxy: [`反向代理到 ${normalized}，建议开启 HTTPS，并把 MySQL 数据库和后台配置加入服务器备份。`],
    storage: "团队后台使用 MySQL 存储；请在 backend.json 中配置 mysql_dsn，并定期备份 timemanage_team 数据库。",
  };
};

export async function runBackendDiagnostics(state: AppState, password?: string): Promise<{ result: BackendDiagnosticResult; state: AppState }> {
  const checkedAt = new Date().toISOString();
  const steps: BackendDiagnosticStep[] = [];
  let workingState = state;
  let lastError: string | undefined;

  const health = await runHealthDiagnosticStep(state);
  steps.push(health.step);
  lastError = health.lastError ?? lastError;

  const login = await runLoginDiagnosticStep(state, workingState, password);
  steps.push(login.step);
  workingState = login.state ?? workingState;
  lastError = login.lastError ?? lastError;

  const token = workingState.auth.token ?? workingState.backend.token;
  if (token) {
    const save = await runSaveDiagnosticStep(workingState, token);
    steps.push(save.step);
    workingState = save.state ?? workingState;
    lastError = save.lastError ?? lastError;

    const load = await runLoadDiagnosticStep(workingState);
    steps.push(load.step);
    workingState = load.state ?? workingState;
    lastError = load.lastError ?? lastError;
  } else {
    steps.push(...unauthenticatedTeamDiagnosticSteps());
  }

  return {
    state: workingState,
    result: {
      checkedAt,
      serverUrl: state.backend.serverUrl,
      lastError,
      steps,
    },
  };
}
