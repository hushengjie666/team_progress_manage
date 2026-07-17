import { afterEach, describe, expect, it, vi } from "vitest";
import { applyAuthStatusFailure, applyTeamStateLoadFailure, applyTeamStateSaveFailure, normalizeAuthMessage } from "./appBoot";
import { shouldResetSignedOutLocalBackendUrl } from "./appBootRuntime";
import { defaultBackendServerUrl } from "./defaultBackendServerUrl";
import { createInitialState } from "./seed";
import { shouldUseRemoteOriginForBackend } from "./teamBackendModel";
import { TeamHttpError } from "./teamBackendHttp";

afterEach(() => {
  vi.unstubAllEnvs();
});

const signedInState = () => {
  const timestamp = "2026-06-30T09:00:00.000Z";
  const state = createInitialState();
  return {
    ...state,
    auth: {
      ...state.auth,
      status: "authenticated" as const,
      token: "token_cached",
      account: {
        id: "account_cached",
        workspaceId: "workspace_cached",
        name: "缓存账号",
        email: "cached@example.com",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      bootstrapped: true,
      message: "已登录",
    },
    backend: {
      ...state.backend,
      token: "token_cached",
    },
  };
};

describe("app boot fallback", () => {
  it("keeps cached sign-in when the team backend cannot be checked", () => {
    const state = signedInState();
    const next = applyAuthStatusFailure(state, new Error("Load failed"));

    expect(next.auth.status).toBe("authenticated");
    expect(next.auth.token).toBe("token_cached");
    expect(next.auth.account).toEqual(state.auth.account);
    expect(next.auth.message).toBe("已登录");
    expect(next.backend.status).toBe("error");
    expect(next.backend.message).toBe("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：Load failed");
  });

  it("clears cached business data when team state cannot be loaded", () => {
    const state = signedInState();
    const next = applyTeamStateLoadFailure(state, new Error("Load failed"));

    expect(next.auth.status).toBe("error");
    expect(next.projects).toEqual([]);
    expect(next.tasks).toEqual([]);
    expect(next.backend.status).toBe("error");
    expect(next.backend.message).toBe("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：Load failed");
  });

  it("clears cached sign-in when auth status says the current workspace can no longer be accessed", () => {
    const state = signedInState();
    const next = applyAuthStatusFailure(state, new TeamHttpError(401, "workspace access denied"));

    expect(next.auth.status).toBe("signed_out");
    expect(next.auth.token).toBeUndefined();
    expect(next.auth.account).toBeUndefined();
    expect(next.backend.token).toBeUndefined();
    expect(next.backend.status).toBe("idle");
    expect(next.auth.message).toBe("登录状态已失效或无权访问当前工作区，请重新登录账号");
    expect(next.backend.message).toBe(next.auth.message);
  });

  it("keeps the account signed in when team data saving is denied", () => {
    const state = signedInState();
    const next = applyTeamStateSaveFailure(state, new TeamHttpError(403, "business row write denied"));

    expect(next.auth.status).toBe("authenticated");
    expect(next.auth.token).toBe("token_cached");
    expect(next.auth.account).toEqual(state.auth.account);
    expect(next.backend.token).toBe("token_cached");
    expect(next.backend.status).toBe("error");
    expect(next.backend.message).toContain("business row write denied");
  });

  it("does not infer session expiry from an untyped error message", () => {
    const state = signedInState();
    const next = applyTeamStateLoadFailure(state, new Error("unauthorized upstream response"));

    expect(next.auth.status).toBe("error");
    expect(next.auth.token).toBe("token_cached");
    expect(next.backend.status).toBe("error");
  });

  it("normalizes stale persisted workspace access errors for login display", () => {
    expect(
      normalizeAuthMessage("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：workspace access denied"),
    ).toBe("登录状态已失效或无权访问当前工作区，请重新登录账号");
  });

  it("resets signed-out local test backend ports without touching remote or signed-in sessions", () => {
    const signedOutLocalTestState = {
      ...createInitialState(),
      backend: {
        ...createInitialState().backend,
        serverUrl: "http://127.0.0.1:54635",
      },
    };
    const signedOutRemoteState = {
      ...createInitialState(),
      backend: {
        ...createInitialState().backend,
        serverUrl: "https://team.example.com/api",
      },
    };
    const signedInLocalTestState = {
      ...signedOutLocalTestState,
      auth: {
        ...signedOutLocalTestState.auth,
        token: "token_cached",
      },
    };

    expect(shouldResetSignedOutLocalBackendUrl(signedOutLocalTestState)).toBe(true);
    expect(shouldResetSignedOutLocalBackendUrl(signedOutRemoteState)).toBe(false);
    expect(shouldResetSignedOutLocalBackendUrl(signedInLocalTestState)).toBe(false);
  });

  it("migrates stale desktop localhost backends to the configured production backend", () => {
    vi.stubEnv("VITE_TM_BACKEND_SERVER_URL", "https://www.hudashuai.xyz/timemanage-team/api/");

    expect(defaultBackendServerUrl()).toBe("https://www.hudashuai.xyz/timemanage-team/api/");
    expect(shouldUseRemoteOriginForBackend("http://127.0.0.1:64567")).toBe(true);
    expect(shouldUseRemoteOriginForBackend("http://localhost:8787")).toBe(true);
    expect(shouldUseRemoteOriginForBackend("https://team.example.com/api")).toBe(false);
  });

  it("keeps the isolated Tauri functional backend ahead of the desktop production backend", () => {
    vi.stubEnv("VITE_TM_BACKEND_SERVER_URL", "https://www.hudashuai.xyz/timemanage-team/api/");
    vi.stubEnv("VITE_WDIO_TAURI", "1");
    vi.stubEnv("VITE_TM_TAURI_FUNCTIONAL_BACKEND_URL", "http://127.0.0.1:64567");

    expect(defaultBackendServerUrl()).toBe("http://127.0.0.1:64567");
  });
});
