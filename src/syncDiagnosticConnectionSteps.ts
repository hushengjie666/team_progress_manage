import { loginToWorkspace } from "./sync";
import { apiUrl, timed } from "./syncDiagnosticHttp";
import type { DiagnosticStepResult } from "./syncDiagnosticStepTypes";
import type { AppState } from "./types";

export const runHealthDiagnosticStep = async (state: AppState): Promise<DiagnosticStepResult> => {
  try {
    const { latencyMs } = await timed(async () => {
      const response = await fetch(apiUrl(state.sync.serverUrl, "/health"));
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      return response.text();
    });
    return {
      step: { id: "health", label: "健康检查", ok: true, latencyMs, detail: "团队后台 /health 可访问。" },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "健康检查失败";
    return {
      lastError,
      step: { id: "health", label: "健康检查", ok: false, detail: lastError },
    };
  }
};

export const runLoginDiagnosticStep = async (
  initialState: AppState,
  workingState: AppState,
  password?: string,
): Promise<DiagnosticStepResult> => {
  if (!password || !initialState.sync.username) {
    const hasToken = Boolean(initialState.auth.token ?? initialState.sync.token);
    return {
      step: {
        id: "login",
        label: "登录",
        ok: hasToken,
        detail: hasToken ? "已有 Token。" : "未提供密码，跳过登录。",
      },
    };
  }

  try {
    const loginResult = await timed(() => loginToWorkspace(workingState.sync, workingState.sync.username, password));
    return {
      state: {
        ...workingState,
        auth: {
          status: "authenticated",
          token: loginResult.result.token,
          expiresAt: loginResult.result.expiresAt,
          account: loginResult.result.account,
          workspace: loginResult.result.workspace,
          bootstrapped: true,
          message: "诊断登录成功",
        },
        sync: { ...workingState.sync, token: loginResult.result.token, username: loginResult.result.account.email },
      },
      step: { id: "login", label: "登录", ok: true, latencyMs: loginResult.latencyMs, detail: "账号可登录，Token 已刷新。" },
    };
  } catch (error) {
    const lastError = error instanceof Error ? error.message : "登录失败";
    return {
      lastError,
      step: { id: "login", label: "登录", ok: false, detail: lastError },
    };
  }
};
