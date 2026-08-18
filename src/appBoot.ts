import type { AppState } from "./types";
import { TeamHttpError } from "./teamBackendHttp";
import { isTeamBackendCompatibilityError } from "./teamBackendCompatibility";

export const teamBackendUnavailableTitle = "团队后台不可用";
export const teamBackendCompatibilityTitle = "客户端与团队后台版本不兼容";

const errorDetail = (error: unknown) => (error instanceof Error ? error.message : undefined);
export const authAccessDeniedMessage = "登录状态已失效或无权访问当前工作区，请重新登录账号";

const withDetail = (message: string, error: unknown) => {
  const detail = errorDetail(error);
  return detail ? `${message}：${detail}` : message;
};

const isAuthSessionRejected = (error: unknown) => error instanceof TeamHttpError && error.status === 401;

export const applyBackendCompatibilityFailure = (state: AppState, error: unknown): AppState => {
  if (!isTeamBackendCompatibilityError(error)) return applyBackendUnavailable(state, error);
  return {
    ...state,
    auth: {
      ...state.auth,
      status: "error",
      message: error.details.message,
    },
    backend: {
      ...state.backend,
      status: "incompatible",
      message: error.details.message,
      compatibility: error.details,
      failureKind: "compatibility",
    },
  };
};

export const normalizeAuthMessage = (message: string) =>
  message.toLowerCase().includes("workspace access denied") ? authAccessDeniedMessage : message;

export const backendUnavailableMessage = (serverUrl: string, error: unknown) =>
  withDetail(`团队后台不可用，请启动后台服务或检查地址：${serverUrl}`, error);

const applyBackendUnavailable = (state: AppState, error: unknown, failureKind: "network" | "load" | "save" = "network"): AppState => {
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
      failureKind,
    },
  };
};

export const applyAuthStatusFailure = (state: AppState, error: unknown): AppState => {
  if (isTeamBackendCompatibilityError(error)) return applyBackendCompatibilityFailure(state, error);
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
        failureKind: "auth",
      },
    };
  }
  return applyBackendUnavailable(state, error);
};

export const applyTeamStateLoadFailure = (state: AppState, error: unknown): AppState => {
  if (isTeamBackendCompatibilityError(error)) return applyBackendCompatibilityFailure(state, error);
  if (isAuthSessionRejected(error)) return applyAuthStatusFailure(state, error);
  const failed = applyBackendUnavailable(state, error, "load");
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
    backend: {
      ...failed.backend,
      message: withDetail("团队业务数据加载失败，请检查网络后重试", error),
      failureKind: "load",
    },
  };
};

export const applyTeamStateSaveFailure = (state: AppState, error: unknown): AppState => {
  if (isTeamBackendCompatibilityError(error)) return applyBackendCompatibilityFailure(state, error);
  if (isAuthSessionRejected(error)) {
    return applyAuthStatusFailure(state, error);
  }
  const failed = applyBackendUnavailable(state, error, "save");
  return {
    ...failed,
    backend: {
      ...failed.backend,
      message: withDetail("团队业务操作保存失败，请稍后重试", error),
      failureKind: "save",
    },
  };
};
