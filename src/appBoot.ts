import type { AppState } from "./types";
import { TeamHttpError } from "./teamBackendHttp";

export const teamBackendUnavailableTitle = "团队后台不可用";

const errorDetail = (error: unknown) => (error instanceof Error ? error.message : undefined);
export const authAccessDeniedMessage = "登录状态已失效或无权访问当前工作区，请重新登录账号";

const withDetail = (message: string, error: unknown) => {
  const detail = errorDetail(error);
  return detail ? `${message}：${detail}` : message;
};

const isAuthSessionRejected = (error: unknown) => error instanceof TeamHttpError && error.status === 401;

export const normalizeAuthMessage = (message: string) =>
  message.toLowerCase().includes("workspace access denied") ? authAccessDeniedMessage : message;

export const backendUnavailableMessage = (serverUrl: string, error: unknown) =>
  withDetail(`团队后台不可用，请启动后台服务或检查地址：${serverUrl}`, error);

const applyBackendUnavailable = (state: AppState, error: unknown): AppState => {
  const message = backendUnavailableMessage(state.backend.serverUrl, error);
  const hasCachedSession = Boolean(state.auth.token);
  return {
    ...state,
    auth: {
      ...state.auth,
      status: hasCachedSession ? "authenticated" : "error",
      message: hasCachedSession ? "已登录" : message,
    },
    backend: {
      ...state.backend,
      status: "error",
      message,
    },
  };
};

export const applyAuthStatusFailure = (state: AppState, error: unknown): AppState => {
  if (isAuthSessionRejected(error)) {
    return {
      ...state,
      auth: {
        status: "signed_out",
        bootstrapped: true,
        message: authAccessDeniedMessage,
      },
      backend: {
        ...state.backend,
        token: undefined,
        status: "idle",
        message: authAccessDeniedMessage,
      },
    };
  }
  return applyBackendUnavailable(state, error);
};

export const applyTeamStateLoadFailure = (state: AppState, error: unknown): AppState => {
  const failed = applyAuthStatusFailure(state, error);
  return {
    ...failed,
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    focusSessions: [],
    workSessions: [],
    executionSignals: [],
    interruptions: [],
    taskTemplates: [],
    templateInstances: [],
    activeTimer: undefined,
  };
};

export const applyTeamStateSaveFailure = (state: AppState, error: unknown): AppState => {
  if (isAuthSessionRejected(error)) {
    return applyAuthStatusFailure(state, error);
  }
  return applyBackendUnavailable(state, error);
};
