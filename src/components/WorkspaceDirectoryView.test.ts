import { describe, expect, it } from "vitest";
import type { WorkspaceMembership } from "../types";
import { countActiveWorkspaceMembers, workspaceTypeForEditSave } from "./WorkspaceDirectoryView";

const timestamp = "2026-06-30T08:00:00.000Z";

const membership = (overrides: Pick<WorkspaceMembership, "id" | "workspaceId" | "accountId"> & Partial<WorkspaceMembership>): WorkspaceMembership => ({
  id: overrides.id,
  workspaceId: overrides.workspaceId,
  accountId: overrides.accountId,
  name: overrides.name ?? overrides.accountId,
  email: overrides.email ?? `${overrides.accountId}@example.com`,
  role: overrides.role ?? "member",
  status: overrides.status ?? "active",
  createdAt: timestamp,
  updatedAt: timestamp,
});

describe("workspace directory view model", () => {
  it("keeps personal private workspace type locked when saving edits", () => {
    expect(workspaceTypeForEditSave("private", "shared")).toBe("private");
    expect(workspaceTypeForEditSave("shared", "private")).toBe("private");
    expect(workspaceTypeForEditSave("shared", "shared")).toBe("shared");
  });

  it("counts active workspace members by account instead of project bindings", () => {
    expect(countActiveWorkspaceMembers("workspace_shared", [
      membership({ id: "membership_owner", workspaceId: "workspace_shared", accountId: "account_owner", role: "owner" }),
      membership({ id: "membership_member", workspaceId: "workspace_shared", accountId: "account_member" }),
      membership({ id: "membership_member_duplicate", workspaceId: "workspace_shared", accountId: "account_member" }),
      membership({ id: "membership_disabled", workspaceId: "workspace_shared", accountId: "account_disabled", status: "disabled" }),
      membership({ id: "membership_other_workspace", workspaceId: "workspace_other", accountId: "account_other" }),
    ])).toBe(2);
  });

  it("counts the workspace owner from the workspace summary when member details are partial", () => {
    expect(countActiveWorkspaceMembers(
      { id: "workspace_shared", ownerAccountId: "account_owner" },
      [
        membership({ id: "membership_teammate", workspaceId: "workspace_shared", accountId: "account_teammate" }),
      ],
    )).toBe(2);
  });

  it("counts the current account when membership details are partial", () => {
    expect(countActiveWorkspaceMembers(
      { id: "workspace_shared", ownerAccountId: "account_owner" },
      [],
      { id: "account_wangshuo", email: "wangshuo", workspaceId: "workspace_shared" },
    )).toBe(2);
  });

  it("does not count a project-only invitee as a workspace member", () => {
    expect(countActiveWorkspaceMembers(
      { id: "workspace_shared", ownerAccountId: "account_owner" },
      [
        membership({ id: "membership_owner", workspaceId: "workspace_shared", accountId: "account_owner", role: "owner" }),
        membership({ id: "membership_teammate", workspaceId: "workspace_shared", accountId: "account_teammate" }),
      ],
      { id: "account_invitee", email: "invitee@example.com", workspaceId: "workspace_private_invitee" },
    )).toBe(2);
  });

  it("counts only the owner for a private workspace", () => {
    expect(countActiveWorkspaceMembers(
      { id: "workspace_private", ownerAccountId: "account_owner", type: "private" },
      [
        membership({ id: "membership_owner_private", workspaceId: "workspace_private", accountId: "account_owner", role: "owner" }),
        membership({ id: "membership_stale_private", workspaceId: "workspace_private", accountId: "account_stale" }),
      ],
      { id: "account_owner", email: "owner@example.com", workspaceId: "workspace_private" },
    )).toBe(1);
  });
});
