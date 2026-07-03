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
  sync: {
    ...state.sync,
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
    },
    setProjectInvitations: (invitations) => {
      projectInvitationCount = invitations.length;
    },
  });
  return {
    runtime,
    getToast: () => toast,
    getPlatformAccounts: () => platformAccounts,
    getInvitationCount: () => invitationCount,
    getProjectInvitationCount: () => projectInvitationCount,
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
