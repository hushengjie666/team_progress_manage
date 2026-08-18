import { loginToWorkspace } from "./teamBackend";
import { apiUrl, timed } from "./teamBackendDiagnosticHttp";
import { clientHeaders } from "./teamBackendHttp";
import type { DiagnosticStepResult } from "./teamBackendDiagnosticStepTypes";
import type { AppState } from "./types";

type HealthStorageSummary = {
  driver?: string;
  database?: string;
  business_rows?: number;
  business_projects?: number;
  business_tasks?: number;
};

type HealthResponse = {
  storage?: HealthStorageSummary;
};

const healthDetail = (payload: HealthResponse | undefined) => {
  const storage = payload?.storage;
  if (!storage) return "团队后台 /health 可访问。";
  const database = storage.database ? `数据库 ${storage.database}` : "MySQL";
  const rows = typeof storage.business_rows === "number" ? `，业务行 ${storage.business_rows}` : "";
  const projects = typeof storage.business_projects === "number" ? `，项目 ${storage.business_projects}` : "";
  const tasks = typeof storage.business_tasks === "number" ? `，任务 ${storage.business_tasks}` : "";
  return `团队后台 /health 可访问，${database}${rows}${projects}${tasks}。`;
};

export const runHealthDiagnosticStep = async (state: AppState): Promise<DiagnosticStepResult> => {
  try {
    const { result, latencyMs } = await timed(async () => {
      const response = await fetch(apiUrl(state.backend.serverUrl, "/health"), { headers: clientHeaders() });
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      return response.json().catch(() => undefined) as Promise<HealthResponse | undefined>;
    });
    return {
      step: { id: "health", label: "健康检查", ok: true, latencyMs, detail: healthDetail(result) },
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
  if (!password || !initialState.backend.username) {
    const hasToken = Boolean(initialState.auth.token ?? initialState.backend.token);
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
    const loginResult = await timed(() => loginToWorkspace(workingState.backend, workingState.backend.username, password));
    const session = loginResult.result;
    const workspaceMemberships = session.membership
      ? [
        session.membership,
        ...(workingState.auth.workspaceMemberships ?? []).filter(
          (membership) =>
            membership.id !== session.membership?.id &&
            (
              membership.workspaceId !== session.membership?.workspaceId ||
              membership.accountId !== session.membership?.accountId
            ),
        ),
      ]
      : workingState.auth.workspaceMemberships;
    return {
      state: {
        ...workingState,
        auth: {
          ...workingState.auth,
          status: "authenticated",
          token: session.token,
          expiresAt: session.expiresAt,
          account: session.account,
          workspace: session.workspace,
          membership: session.membership,
          workspaces: session.workspaces,
          workspaceMemberships,
          bootstrapped: true,
          message: "诊断登录成功",
        },
        backend: { ...workingState.backend, token: session.token, username: session.account.email },
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
