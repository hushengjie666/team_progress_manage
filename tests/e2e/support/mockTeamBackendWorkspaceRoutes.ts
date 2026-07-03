import type { Route } from "@playwright/test";
import {
  membershipResponse,
  workspaceResponse,
} from "./mockTeamBackendSerializers";
import { fulfillError, fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockWorkspaceRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname === "/workspaces") {
    await fulfillJson(route, {
      workspaces: runtime.mockWorkspaces.map(workspaceResponse) ?? [],
      memberships: runtime.mockMemberships.map(membershipResponse) ?? [],
    });
    return true;
  }

  if (!url.pathname.startsWith("/workspaces/")) return false;

  const workspacePathParts = url.pathname.split("/").filter(Boolean);
  const workspaceId = decodeURIComponent(workspacePathParts[1] ?? "");
  if (workspacePathParts.length === 4 && workspacePathParts[2] === "members") {
    const membershipId = decodeURIComponent(workspacePathParts[3] ?? "");
    const membership = runtime.mockMemberships.find((item) => item.workspaceId === workspaceId && item.id === membershipId);
    if (request.method() !== "PATCH" || !membership) {
      await fulfillError(route, membership ? 405 : 404, membership ? "method not allowed" : "workspace member not found");
      return true;
    }

    const body = request.postDataJSON() as { status?: "active" | "disabled" };
    const now = new Date().toISOString();
    const updatedMembership = {
      ...membership,
      status: body.status ?? membership.status,
      updatedAt: now,
    };
    runtime.mockMemberships = runtime.mockMemberships.map((item) => (item.id === membershipId ? updatedMembership : item));
    await fulfillJson(route, {
      membership: membershipResponse(updatedMembership),
    });
    return true;
  }

  const workspace = runtime.mockWorkspaces.find((item) => item.id === workspaceId);
  if (request.method() !== "PATCH" || !workspace) {
    await fulfillError(route, workspace ? 405 : 404, workspace ? "method not allowed" : "workspace not found");
    return true;
  }

  const body = request.postDataJSON() as { name?: string; type?: "private" | "shared"; owner_account_id?: string };
  const now = new Date().toISOString();
  const updatedWorkspace = {
    ...workspace,
    name: body.name?.trim() || workspace.name,
    type: body.type ?? workspace.type,
    ownerAccountId: body.owner_account_id || workspace.ownerAccountId,
    updatedAt: now,
  };
  runtime.mockWorkspaces = runtime.mockWorkspaces.map((item) => (item.id === workspaceId ? updatedWorkspace : item));
  if (body.owner_account_id) {
    runtime.mockMemberships = runtime.mockMemberships.map((membership) =>
      membership.workspaceId === workspaceId
        ? {
            ...membership,
            role: membership.accountId === body.owner_account_id ? "owner" : membership.role === "owner" ? "member" : membership.role,
            updatedAt: now,
          }
        : membership,
    );
  }
  await fulfillJson(route, {
    workspace: workspaceResponse(updatedWorkspace),
  });
  return true;
};
