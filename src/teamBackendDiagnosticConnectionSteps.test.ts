import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { createTestState } from "./test/fixtures";
import { runHealthDiagnosticStep, runLoginDiagnosticStep } from "./teamBackendDiagnosticConnectionSteps";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team backend diagnostic connection steps", () => {
  it("preserves workspace membership data after diagnostic login", async () => {
    const state = createTestState({
      backend: {
        serverUrl: "http://127.0.0.1:8787",
        username: "admin",
        deviceId: "device_test",
        status: "idle",
        message: "",
      },
      auth: {
        status: "authenticated",
        bootstrapped: true,
        message: "",
      },
    });
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      token: "token_test",
      user_id: "account_admin",
      expires_at: "2026-08-03T04:00:01Z",
      account: {
        id: "account_admin",
        workspace_id: "workspace_private_account_admin",
        name: "超级管理员",
        email: "admin",
        created_at: "2026-07-04T03:51:16Z",
        updated_at: "2026-07-04T03:51:16Z",
      },
      workspace: {
        id: "workspace_private_account_admin",
        name: "超级管理员的私人工作区",
        type: "private",
        owner_account_id: "account_admin",
        created_at: "2026-07-04T03:51:16Z",
        updated_at: "2026-07-04T04:00:01Z",
      },
      membership: {
        id: "membership_workspace_private_account_admin_account_admin",
        workspace_id: "workspace_private_account_admin",
        account_id: "account_admin",
        name: "超级管理员",
        email: "admin",
        role: "owner",
        status: "active",
        created_at: "2026-07-04T03:51:16Z",
        updated_at: "2026-07-04T04:00:01Z",
      },
      workspaces: [{
        id: "workspace_private_account_admin",
        name: "超级管理员的私人工作区",
        type: "private",
        owner_account_id: "account_admin",
        created_at: "2026-07-04T03:51:16Z",
        updated_at: "2026-07-04T04:00:01Z",
      }],
    }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    })));

    const result = await runLoginDiagnosticStep(state, state, "hu626699");

    expect(result.state?.auth.membership?.accountId).toBe("account_admin");
    expect(result.state?.auth.workspaces?.[0]?.id).toBe("workspace_private_account_admin");
    expect(result.state?.auth.workspaceMemberships).toHaveLength(1);
    expect(result.state?.auth.workspaceMemberships?.[0]?.role).toBe("owner");
  });

  it("includes backend storage summary in health diagnostics when available", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "ok",
      storage: {
        driver: "mysql",
        database: "timemanage_team",
        business_rows: 160,
        business_projects: 4,
        business_tasks: 19,
      },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const result = await runHealthDiagnosticStep(createInitialState());

    expect(result.step.ok).toBe(true);
    expect(result.step.detail).toBe("团队后台 /health 可访问，数据库 timemanage_team，业务行 160，项目 4，任务 19。");
  });
});
