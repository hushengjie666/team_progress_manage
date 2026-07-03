import type { Workspace, WorkspaceMembership } from "../types";
import { iso } from "./fixtures";

export const projectOverviewAccessNow = iso("2026-05-10T08:00:00Z");

export const workspaceFixture = ({ id, ...overrides }: Partial<Workspace> & Pick<Workspace, "id">): Workspace => ({
  id,
  name: "协作区",
  type: "shared",
  ownerAccountId: "account_owner",
  createdAt: projectOverviewAccessNow,
  updatedAt: projectOverviewAccessNow,
  ...overrides,
});

export const workspaceMembershipFixture = ({
  id,
  workspaceId,
  accountId,
  ...overrides
}: Partial<WorkspaceMembership> & Pick<WorkspaceMembership, "id" | "workspaceId" | "accountId">): WorkspaceMembership => ({
  id,
  workspaceId,
  accountId,
  name: overrides.name ?? accountId,
  email: overrides.email ?? `${accountId}@example.com`,
  role: overrides.role ?? "member",
  status: overrides.status ?? "active",
  createdAt: projectOverviewAccessNow,
  updatedAt: projectOverviewAccessNow,
  ...overrides,
});
