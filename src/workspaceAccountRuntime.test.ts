import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import {
  createWorkspaceAccountRuntime,
  loadWorkspaceAccountMetadata,
} from "./workspaceAccountRuntime";
import type { Account, AppState } from "./types";

const serverAccount = {
  id: "account_1",
  workspace_id: "workspace_1",
  name: "Alice",
  email: "alice@example.com",
  disabled_at: "",
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
};

const serverInvitation = {
  id: "invitation_1",
  workspace_id: "workspace_1",
  workspace_name: "交付团队",
  workspace_type: "shared",
  inviter_account_id: "account_admin",
  inviter_name: "Admin",
  inviter_email: "admin",
  invitee_account_id: "account_2",
  invitee_email: "bob@example.com",
  status: "pending",
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  accepted_at: "",
};

const serverProjectInvitation = {
  id: "project_invitation_1",
  workspace_id: "workspace_1",
  workspace_name: "交付团队",
  project_id: "project_1",
  project_name: "消毒中心",
  inviter_account_id: "account_admin",
  inviter_name: "Admin",
  inviter_email: "admin",
  invitee_account_id: "account_2",
  invitee_email: "bob@example.com",
  roles: ["executor"],
  status: "pending",
  created_at: "2026-07-01T08:00:00.000Z",
  updated_at: "2026-07-01T08:00:00.000Z",
  accepted_at: "",
};

const withAdminToken = (state: AppState): AppState => ({
  ...state,
  auth: {
    ...state.auth,
    status: "authenticated",
    token: "token_admin",
    account: {
      id: "account_admin",
      workspaceId: "workspace_1",
      name: "Admin",
      email: "admin",
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    },
    message: "已登录",
  },
  backend: {
    ...state.backend,
    serverUrl: "http://127.0.0.1:8787",
    token: "token_admin",
  },
});

const createRuntimeHarness = (initial: AppState | null, initialPlatformAccounts: Account[] = []) => {
  let current = initial;
  let toast = "";
  let platformAccounts: Account[] = initialPlatformAccounts;
  let invitationCount = 0;
  let projectInvitationCount = 0;
  const workspaceInvitationUpdateCounts: number[] = [];
  const projectInvitationUpdateCounts: number[] = [];
  const runtime = createWorkspaceAccountRuntime({
    getState: () => current,
    setState: (updater) => {
      current = typeof updater === "function" ? updater(current) : updater;
    },
    setToast: (message) => {
      toast = message;
    },
    setPlatformAccounts: (accounts) => {
      platformAccounts = accounts;
    },
    getPlatformAccounts: () => platformAccounts,
    setWorkspaceInvitations: (invitations) => {
      invitationCount = invitations.length;
      workspaceInvitationUpdateCounts.push(invitations.length);
    },
    setProjectInvitations: (invitations) => {
      projectInvitationCount = invitations.length;
      projectInvitationUpdateCounts.push(invitations.length);
    },
  });
  return {
    runtime,
    getToast: () => toast,
    getPlatformAccounts: () => platformAccounts,
    getInvitationCount: () => invitationCount,
    getProjectInvitationCount: () => projectInvitationCount,
    getWorkspaceInvitationUpdateCounts: () => workspaceInvitationUpdateCounts,
    getProjectInvitationUpdateCounts: () => projectInvitationUpdateCounts,
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspace account runtime", () => {
  it("does not request account metadata without a token", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const metadata = await loadWorkspaceAccountMetadata(createInitialState());

    expect(metadata).toEqual({ platformAccounts: [], workspaceInvitations: [], projectInvitations: [] });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("loads platform accounts and invitations for a super admin", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/admin/accounts")) {
        return new Response(JSON.stringify({ accounts: [serverAccount] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/workspace-invitations")) {
        return new Response(JSON.stringify({ invitations: [serverInvitation] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/project-invitations")) {
        return new Response(JSON.stringify({ invitations: [serverProjectInvitation] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404, headers: { "content-type": "application/json" } });
    }));

    const metadata = await loadWorkspaceAccountMetadata(withAdminToken(createInitialState()));

    expect(metadata.platformAccounts).toEqual([{
      id: "account_1",
      workspaceId: "workspace_1",
      name: "Alice",
      email: "alice@example.com",
      disabledAt: undefined,
      createdAt: "2026-07-01T08:00:00.000Z",
      updatedAt: "2026-07-01T08:00:00.000Z",
    }]);
    expect(metadata.workspaceInvitations[0]?.workspaceName).toBe("交付团队");
    expect(metadata.projectInvitations[0]?.projectName).toBe("消毒中心");
  });

  it("surfaces invitation metadata load failures instead of returning empty invitations", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith("/admin/accounts")) {
        return new Response(JSON.stringify({ accounts: [serverAccount] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/workspace-invitations")) {
        return new Response(JSON.stringify({ error: "workspace invitations unavailable" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/project-invitations")) {
        return new Response(JSON.stringify({ invitations: [serverProjectInvitation] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404, headers: { "content-type": "application/json" } });
    }));

    await expect(loadWorkspaceAccountMetadata(withAdminToken(createInitialState()))).rejects.toThrow("workspace invitations unavailable");
  });

  it("does not clear workspace invitations when refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "workspace invitations unavailable" }), { status: 500, headers: { "content-type": "application/json" } }),
    ));
    const { runtime, getWorkspaceInvitationUpdateCounts } = createRuntimeHarness(withAdminToken(createInitialState()));

    await expect(runtime.refreshWorkspaceInvitations()).rejects.toThrow("workspace invitations unavailable");

    expect(getWorkspaceInvitationUpdateCounts()).toEqual([]);
  });

  it("does not clear project invitations when refresh fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "project invitations unavailable" }), { status: 500, headers: { "content-type": "application/json" } }),
    ));
    const { runtime, getProjectInvitationUpdateCounts } = createRuntimeHarness(withAdminToken(createInitialState()));

    await expect(runtime.refreshProjectInvitations()).rejects.toThrow("project invitations unavailable");

    expect(getProjectInvitationUpdateCounts()).toEqual([]);
  });

  it("normalizes invitation email before sending", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ invitation: { ...serverInvitation, invitee_email: "bob@example.com" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getToast } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.inviteWorkspaceMember("workspace_1", "  Bob@Example.COM ");
    await vi.waitFor(() => expect(getToast()).toBe("已向 bob@example.com 发送工作区邀请"));

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? ""))).toMatchObject({
      workspace_id: "workspace_1",
      email: "bob@example.com",
    });
  });

  it("normalizes project invitation email before sending", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      new Response(JSON.stringify({ invitation: { ...serverProjectInvitation, invitee_email: "bob@example.com" } }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getToast } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.inviteProjectMember({ workspaceId: "workspace_1", projectId: "project_1", email: "  Bob@Example.COM ", roles: ["executor"] });
    await vi.waitFor(() => expect(getToast()).toBe("已向 bob@example.com 发送项目邀请"));

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? ""))).toMatchObject({
      workspace_id: "workspace_1",
      project_id: "project_1",
      email: "bob@example.com",
      roles: ["executor"],
    });
  });

  it("deletes a pending workspace invitation through the runtime", async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/workspace-invitations/invitation_1") && init?.method === "DELETE") {
        deleted = true;
        return new Response(JSON.stringify({ invitation: { ...serverInvitation, status: "cancelled" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/workspace-invitations")) {
        return new Response(JSON.stringify({ invitations: deleted ? [] : [serverInvitation] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getToast, getWorkspaceInvitationUpdateCounts } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.deletePendingWorkspaceInvitation("invitation_1");
    await vi.waitFor(() => expect(getToast()).toBe("已删除工作区邀请"));

    expect(fetchMock.mock.calls.map((call) => [String(call[0]), call[1]?.method ?? "GET"])).toEqual([
      ["http://127.0.0.1:8787/workspace-invitations/invitation_1", "DELETE"],
      ["http://127.0.0.1:8787/workspace-invitations", "GET"],
    ]);
    expect(getWorkspaceInvitationUpdateCounts()).toEqual([0]);
  });

  it("deletes a pending project invitation through the runtime", async () => {
    let deleted = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/project-invitations/project_invitation_1") && init?.method === "DELETE") {
        deleted = true;
        return new Response(JSON.stringify({ invitation: { ...serverProjectInvitation, status: "cancelled" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/project-invitations")) {
        return new Response(JSON.stringify({ invitations: deleted ? [] : [serverProjectInvitation] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getToast, getProjectInvitationUpdateCounts } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.deletePendingProjectInvitation("project_invitation_1");
    await vi.waitFor(() => expect(getToast()).toBe("已删除项目邀请"));

    expect(fetchMock.mock.calls.map((call) => [String(call[0]), call[1]?.method ?? "GET"])).toEqual([
      ["http://127.0.0.1:8787/project-invitations/project_invitation_1", "DELETE"],
      ["http://127.0.0.1:8787/project-invitations", "GET"],
    ]);
    expect(getProjectInvitationUpdateCounts()).toEqual([0]);
  });

  it("does not report project invitation acceptance as failed when only state refresh fails", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/project-invitations") && !init?.method) {
        return new Response(JSON.stringify({ invitations: [serverProjectInvitation] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/project-invitations/project_invitation_1/accept") && init?.method === "POST") {
        return new Response(JSON.stringify({
          invitation: {
            ...serverProjectInvitation,
            status: "accepted",
            accepted_at: "2026-07-01T08:05:00.000Z",
          },
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/workspaces")) {
        return new Response(JSON.stringify({ error: "save failed" }), { status: 500, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/project-invitations")) {
        return new Response(JSON.stringify({ invitations: [] }), { status: 200, headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), { status: 404, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getToast } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.acceptPendingProjectInvitation("project_invitation_1");
    await vi.waitFor(() => expect(getToast()).toBe("已加入项目 消毒中心，刷新项目数据失败，请刷新页面"));

    expect(fetchMock.mock.calls.map((call) => String(call[0]))).toEqual([
      "http://127.0.0.1:8787/project-invitations/project_invitation_1/accept",
      "http://127.0.0.1:8787/workspaces",
    ]);
  });

  it("creates platform accounts through the runtime and refreshes the account list", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.endsWith("/admin/accounts") && init?.method === "POST") {
        return new Response(JSON.stringify({ account: serverAccount }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.endsWith("/admin/accounts")) {
        return new Response(JSON.stringify({ accounts: [serverAccount] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "unexpected request" }), {
        status: 404,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { runtime, getPlatformAccounts, getToast } = createRuntimeHarness(withAdminToken(createInitialState()));

    runtime.createPlatformAccount(" Alice ", " Alice@Example.COM ", "secret");
    await vi.waitFor(() => expect(getToast()).toBe("平台账号已创建，可在工作区或项目中授权使用"));

    expect(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body ?? ""))).toMatchObject({
      name: "Alice",
      email: "alice@example.com",
      password: "secret",
      status: "active",
    });
    expect(getPlatformAccounts()[0]?.email).toBe("alice@example.com");
  });

  it("reports workspace update failures through the runtime interface", async () => {
    vi.stubGlobal("fetch", vi.fn(async () =>
      new Response(JSON.stringify({ error: "workspace locked" }), { status: 409, headers: { "content-type": "application/json" } }),
    ));
    const { runtime, getToast } = createRuntimeHarness(withAdminToken(createInitialState()));

    const saved = await runtime.updateWorkspace("workspace_1", { name: "交付团队", type: "shared" });

    expect(saved).toBe(false);
    expect(getToast()).toContain("workspace locked");
  });
});
