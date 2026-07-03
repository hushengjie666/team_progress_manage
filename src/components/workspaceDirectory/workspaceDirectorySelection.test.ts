import { describe, expect, it } from "vitest";
import type { Account, Workspace, WorkspaceMembership } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";
import { buildWorkspaceDirectorySelection } from "./workspaceDirectorySelection";

const now = "2026-07-01T08:00:00.000Z";

const workspace = (overrides: Partial<Workspace> = {}): Workspace => ({
  id: "workspace_shared",
  name: "协作区",
  type: "shared",
  ownerAccountId: "account_owner",
  createdAt: now,
  updatedAt: now,
  ...overrides,
});

const member = (overrides: Partial<WorkspaceMembership> & Pick<WorkspaceMembership, "id" | "accountId" | "role">): WorkspaceMembership => ({
  id: overrides.id,
  workspaceId: overrides.workspaceId ?? "workspace_shared",
  accountId: overrides.accountId,
  name: overrides.name ?? overrides.accountId,
  email: overrides.email ?? `${overrides.accountId}@example.com`,
  role: overrides.role,
  status: overrides.status ?? "active",
  createdAt: now,
  updatedAt: now,
});

const card = (workspaceValue: Workspace): WorkspaceDirectoryCard => ({
  workspace: workspaceValue,
  projects: [],
  taskCount: 0,
  memberCount: 0,
  pendingReviewCount: 0,
  riskCount: 0,
  progressPercent: 0,
});

describe("workspace directory selection", () => {
  it("derives owner edit permissions and selected owner account", () => {
    const currentAccount: Account = {
      id: "account_owner",
      workspaceId: "workspace_shared",
      name: "负责人",
      email: "owner@example.com",
      createdAt: now,
      updatedAt: now,
    };
    const selection = buildWorkspaceDirectorySelection({
      activeModal: { workspaceId: "workspace_shared", kind: "members" },
      directoryCards: [card(workspace())],
      workspaceMemberships: [
        member({ id: "membership_owner", accountId: "account_owner", role: "owner" }),
        member({ id: "membership_member", accountId: "account_member", role: "member" }),
      ],
      currentAccount,
      workspaceEditDraft: { name: "", type: "shared", ownerAccountId: "" },
      workspaceMemberDrafts: {},
    });

    expect(selection.selectedOwnerAccountId).toBe("account_owner");
    expect(selection.canEditSelectedWorkspace).toBe(true);
    expect(selection.canChangeSelectedWorkspaceType).toBe(true);
    expect(selection.canChangeSelectedWorkspaceOwner).toBe(true);
  });

  it("prevents private workspace type and owner changes", () => {
    const selection = buildWorkspaceDirectorySelection({
      activeModal: { workspaceId: "workspace_private", kind: "members" },
      directoryCards: [card(workspace({ id: "workspace_private", type: "private", ownerAccountId: "account_owner" }))],
      workspaceMemberships: [
        member({ id: "membership_owner", workspaceId: "workspace_private", accountId: "account_owner", role: "owner" }),
      ],
      currentAccount: {
        id: "account_owner",
        workspaceId: "workspace_private",
        name: "负责人",
        email: "owner@example.com",
        createdAt: now,
        updatedAt: now,
      },
      workspaceEditDraft: { name: "", type: "private", ownerAccountId: "" },
      workspaceMemberDrafts: {},
    });

    expect(selection.canEditSelectedWorkspace).toBe(true);
    expect(selection.canChangeSelectedWorkspaceType).toBe(false);
    expect(selection.canChangeSelectedWorkspaceOwner).toBe(false);
  });
});
