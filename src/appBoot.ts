import type { AppState } from "./types";

export const teamBackendUnavailableTitle = "团队后台不可用";

const errorDetail = (error: unknown) => (error instanceof Error ? error.message : undefined);
export const authAccessDeniedMessage = "登录状态已失效或无权访问当前工作区，请重新登录账号";

const withDetail = (message: string, error: unknown) => {
  const detail = errorDetail(error);
  return detail ? `${message}：${detail}` : message;
};

const isAuthAccessDeniedError = (error: unknown) => {
  const detail = errorDetail(error)?.toLowerCase() ?? "";
  return [
    "workspace access denied",
    "invalid token",
    "token expired",
    "missing auth",
    "unauthorized",
    "forbidden",
    "account disabled",
    "membership disabled",
  ].some((pattern) => detail.includes(pattern));
};

export const normalizeAuthMessage = (message: string) =>
  message.toLowerCase().includes("workspace access denied") ? authAccessDeniedMessage : message;

export const backendUnavailableMessage = (serverUrl: string, error: unknown) =>
  withDetail(`团队后台不可用，请启动后台服务或检查地址：${serverUrl}`, error);

export const applyAuthStatusFailure = (state: AppState, error: unknown): AppState => {
  if (isAuthAccessDeniedError(error)) {
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
  const message = backendUnavailableMessage(state.backend.serverUrl, error);
  return {
    ...state,
    auth: {
      ...state.auth,
      status: "error",
      message,
    },
    backend: {
      ...state.backend,
      status: "error",
      message,
    },
  };
};

export const applyTeamStateLoadFailure = applyAuthStatusFailure;

export const applyTeamStateSaveFailure = (state: AppState, error: unknown): AppState => {
  if (isAuthAccessDeniedError(error) && !errorDetail(error)?.toLowerCase().includes("workspace access denied")) {
    return applyAuthStatusFailure(state, error);
  }
  const message = backendUnavailableMessage(state.backend.serverUrl, error);
  return {
    ...state,
    auth: {
      ...state.auth,
      status: state.auth.status === "authenticated" ? "authenticated" : "error",
      message,
    },
    backend: {
      ...state.backend,
      status: "error",
      message,
    },
  };
};
