import { describe, expect, it } from "vitest";
import { applyAuthStatusFailure, applyTeamStateLoadFailure, normalizeAuthMessage } from "./appBoot";
import { createInitialState } from "./seed";

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
  it("blocks cached sign-in when the team backend cannot be checked", () => {
    const state = signedInState();
    const next = applyAuthStatusFailure(state, new Error("Load failed"));

    expect(next.auth.status).toBe("error");
    expect(next.auth.token).toBe("token_cached");
    expect(next.auth.account).toEqual(state.auth.account);
    expect(next.backend.status).toBe("error");
    expect(next.auth.message).toBe("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：Load failed");
    expect(next.backend.message).toBe(next.auth.message);
  });

  it("blocks the app when team state cannot be loaded from the backend", () => {
    const state = signedInState();
    const next = applyTeamStateLoadFailure(state, new Error("Load failed"));

    expect(next.auth.status).toBe("error");
    expect(next.projects).toEqual(state.projects);
    expect(next.tasks).toEqual(state.tasks);
    expect(next.backend.status).toBe("error");
    expect(next.backend.message).toBe("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：Load failed");
  });

  it("clears cached sign-in when the current workspace can no longer be accessed", () => {
    const state = signedInState();
    const next = applyTeamStateLoadFailure(state, new Error("workspace access denied"));

    expect(next.auth.status).toBe("signed_out");
    expect(next.auth.token).toBeUndefined();
    expect(next.auth.account).toBeUndefined();
    expect(next.backend.token).toBeUndefined();
    expect(next.backend.status).toBe("idle");
    expect(next.auth.message).toBe("登录状态已失效或无权访问当前工作区，请重新登录账号");
    expect(next.backend.message).toBe(next.auth.message);
  });

  it("normalizes stale persisted workspace access errors for login display", () => {
    expect(
      normalizeAuthMessage("团队后台不可用，请启动后台服务或检查地址：http://127.0.0.1:8787：workspace access denied"),
    ).toBe("登录状态已失效或无权访问当前工作区，请重新登录账号");
  });
});
