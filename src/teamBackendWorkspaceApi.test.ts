import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { createWorkspace, loginToWorkspace, switchWorkspace, updateWorkspace } from "./teamBackend";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("workspace backend api", () => {
  it("maps multi-workspace login responses for workspace switching", async () => {
    const backend = { ...createInitialState().backend, serverUrl: "http://127.0.0.1:8787", deviceId: "device_test" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        token: "token_shared",
        user_id: "account_owner",
        expires_at: "2099-01-01T00:00:00Z",
        account: {
          id: "account_owner",
          workspace_id: "workspace_shared",
          name: "负责人",
          email: "owner@example.com",
          created_at: "2026-07-01T08:00:00Z",
          updated_at: "2026-07-01T08:00:00Z",
        },
        workspace: {
          id: "workspace_shared",
          name: "协作区",
          type: "shared",
          owner_account_id: "account_owner",
          created_at: "2026-07-01T08:00:00Z",
          updated_at: "2026-07-01T08:00:00Z",
        },
        membership: {
          id: "membership_workspace_shared_account_owner",
          workspace_id: "workspace_shared",
          account_id: "account_owner",
          name: "负责人",
          email: "owner@example.com",
          role: "owner",
          status: "active",
          created_at: "2026-07-01T08:00:00Z",
          updated_at: "2026-07-01T08:00:00Z",
        },
        workspaces: [
          {
            id: "workspace_private_account_owner",
            name: "负责人私人工作区",
            type: "private",
            owner_account_id: "account_owner",
            created_at: "2026-07-01T08:00:00Z",
            updated_at: "2026-07-01T08:00:00Z",
          },
          {
            id: "workspace_shared",
            name: "协作区",
            type: "shared",
            owner_account_id: "account_owner",
            created_at: "2026-07-01T08:00:00Z",
            updated_at: "2026-07-01T08:00:00Z",
          },
        ],
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const session = await loginToWorkspace(backend, "owner@example.com", "secret");

    expect(session.workspace).toMatchObject({ id: "workspace_shared", type: "shared", ownerAccountId: "account_owner" });
    expect(session.membership).toMatchObject({ workspaceId: "workspace_shared", accountId: "account_owner", role: "owner" });
    expect(session.workspaces.map((workspace) => [workspace.id, workspace.type])).toEqual([
      ["workspace_private_account_owner", "private"],
      ["workspace_shared", "shared"],
    ]);
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8787/auth/login");
  });

  it("posts workspace switching and workspace creation requests to the backend", async () => {
    const backend = { ...createInitialState().backend, serverUrl: "http://127.0.0.1:8787", deviceId: "device_test" };
    const response = {
      token: "token_next",
      user_id: "account_owner",
      expires_at: "2099-01-01T00:00:00Z",
      account: {
        id: "account_owner",
        workspace_id: "workspace_next",
        name: "负责人",
        email: "owner@example.com",
        created_at: "2026-07-01T08:00:00Z",
        updated_at: "2026-07-01T08:00:00Z",
      },
      workspace: {
        id: "workspace_next",
        name: "协作区",
        type: "shared",
        created_at: "2026-07-01T08:00:00Z",
        updated_at: "2026-07-01T08:00:00Z",
      },
      workspaces: [],
    };
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => response });
    vi.stubGlobal("fetch", fetchMock);

    await switchWorkspace(backend, "token_current", "workspace_next");
    await createWorkspace(backend, "token_next", "新协作区");

    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8787/auth/switch-workspace");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({ workspace_id: "workspace_next", device_id: "device_test" });
    expect(String(fetchMock.mock.calls[1][0])).toBe("http://127.0.0.1:8787/workspaces");
    expect(JSON.parse(String(fetchMock.mock.calls[1][1]?.body))).toMatchObject({ name: "新协作区", type: "shared", device_id: "device_test" });
  });

  it("patches workspace name, type, and owner", async () => {
    const backend = { ...createInitialState().backend, serverUrl: "http://127.0.0.1:8787", deviceId: "device_test" };
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        workspace: {
          id: "workspace_shared",
          name: "私人事项",
          type: "private",
          owner_account_id: "account_owner",
          created_at: "2026-07-01T08:00:00Z",
          updated_at: "2026-07-01T09:00:00Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const workspace = await updateWorkspace(backend, "token_current", "workspace_shared", {
      name: "私人事项",
      type: "private",
      ownerAccountId: "account_owner",
    });

    expect(workspace).toMatchObject({ id: "workspace_shared", name: "私人事项", type: "private" });
    expect(String(fetchMock.mock.calls[0][0])).toBe("http://127.0.0.1:8787/workspaces/workspace_shared");
    expect(fetchMock.mock.calls[0][1]?.method).toBe("PATCH");
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toMatchObject({
      name: "私人事项",
      type: "private",
      owner_account_id: "account_owner",
    });
  });
});
