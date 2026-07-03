import { afterEach, describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { loadTeamState } from "./teamApi";
import type { SyncRow } from "./sync";
import type { SyncState } from "./types";

const iso = (value: string) => new Date(value).toISOString();

const syncRow = (row: Omit<SyncRow, "device_id" | "revision" | "version">): SyncRow => ({
  device_id: "remote",
  revision: 1,
  version: 1,
  ...row,
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("team backend state loading", () => {
  it("does not resurrect starter members when the remote team has no member rows", async () => {
    const base = createInitialState();
    const local = {
      ...base,
      auth: {
        status: "authenticated" as const,
        token: "token",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "负责人",
          email: "owner@example.com",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        workspace: {
          id: "workspace_test",
          name: "测试团队",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        bootstrapped: true,
        message: "已登录",
      },
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_revision: 7,
      changes: [],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamState(local);

    expect(loaded.projects).toEqual([]);
    expect(loaded.projectMembers).toEqual([]);
  });

  it("records hidden duplicate project member identities as aliases when loading team state", async () => {
    const base = createInitialState();
    const local = {
      ...base,
      auth: {
        status: "authenticated" as const,
        token: "token",
        account: {
          id: "account_owner",
          workspaceId: "workspace_test",
          name: "项目负责人",
          email: "owner@example.com",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        workspace: {
          id: "workspace_test",
          name: "测试团队",
          createdAt: iso("2026-06-30T06:00:00Z"),
          updatedAt: iso("2026-06-30T06:00:00Z"),
        },
        bootstrapped: true,
        message: "已登录",
      },
      sync: {
        ...base.sync,
        serverUrl: "http://127.0.0.1:8787",
        token: "token",
      } satisfies SyncState,
    };
    const canonicalProjectMember = {
      ...base.projectMembers[0],
      id: "member_account_owner",
      accountId: "account_owner",
      email: "owner@example.com",
      updatedAt: iso("2026-06-30T06:20:00Z"),
    };
    const duplicateProjectMember = {
      ...canonicalProjectMember,
      id: "member_owner_duplicate",
      updatedAt: iso("2026-06-30T06:10:00Z"),
    };

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      current_revision: 12,
      changes: [
        syncRow({
          entity: "project",
          id: base.projects[0].id,
          updated_at: base.projects[0].updatedAt,
          payload: base.projects[0],
        }),
        syncRow({
          entity: "project_member",
          id: canonicalProjectMember.id,
          updated_at: canonicalProjectMember.updatedAt,
          payload: canonicalProjectMember,
        }),
        syncRow({
          entity: "project_member",
          id: duplicateProjectMember.id,
          updated_at: duplicateProjectMember.updatedAt,
          payload: duplicateProjectMember,
        }),
      ],
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const loaded = await loadTeamState(local);

    expect(loaded.projectMembers.map((member) => member.id)).toEqual([canonicalProjectMember.id]);
  });
});
