import type { Route } from "@playwright/test";
import { fulfillError, fulfillJson } from "./mockTeamBackendResponses";
import type { MockTeamBackendRuntime } from "./mockTeamBackendRuntime";

export const handleMockInvitationRoute = async (
  route: Route,
  url: URL,
  runtime: MockTeamBackendRuntime,
) => {
  const request = route.request();
  if (url.pathname.startsWith("/project-invitations/") && url.pathname.endsWith("/accept")) {
    const invitationId = decodeURIComponent(url.pathname.replace("/project-invitations/", "").replace("/accept", ""));
    const invitationIndex = runtime.projectInvitations.findIndex((invitation) => invitation.id === invitationId);
    if (request.method() !== "POST" || invitationIndex < 0) {
      await fulfillError(
        route,
        invitationIndex < 0 ? 404 : 405,
        invitationIndex < 0 ? "project invitation not found" : "method not allowed",
      );
      return true;
    }

    const now = new Date().toISOString();
    const invitation = {
      ...runtime.projectInvitations[invitationIndex],
      status: "accepted" as const,
      updated_at: now,
      accepted_at: now,
    };
    runtime.projectInvitations[invitationIndex] = invitation;
    runtime.projectInvitationAccepted = true;
    runtime.activeWorkspaceId = invitation.workspace_id;
    if (runtime.options.acceptedProjectInvitationState) {
      runtime.workspaceStates[invitation.workspace_id] = runtime.options.acceptedProjectInvitationState;
    }
    await fulfillJson(route, { invitation });
    return true;
  }

  if (url.pathname === "/workspace-invitations") {
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { workspace_id?: string; email?: string };
      const workspace = runtime.mockWorkspaces.find((item) => item.id === body.workspace_id);
      const now = new Date().toISOString();
      const invitation = {
        id: `workspace_invitation_${runtime.workspaceInvitations.length + 1}`,
        workspace_id: workspace?.id ?? body.workspace_id ?? "",
        workspace_name: workspace?.name ?? "未知工作区",
        workspace_type: workspace?.type ?? "shared",
        inviter_account_id: runtime.initialState.auth.account?.id ?? "account_owner",
        inviter_name: runtime.initialState.auth.account?.name ?? "项目负责人",
        inviter_email: runtime.initialState.auth.account?.email ?? "owner@example.com",
        invitee_account_id: `account_${body.email ?? "invitee"}`,
        invitee_email: body.email ?? "",
        status: "pending",
        created_at: now,
        updated_at: now,
      };
      runtime.workspaceInvitations.push(invitation);
      await fulfillJson(route, { invitation });
      return true;
    }

    await fulfillJson(route, { invitations: runtime.workspaceInvitations });
    return true;
  }

  if (url.pathname === "/project-invitations") {
    if (request.method() === "POST") {
      const body = request.postDataJSON() as { workspace_id?: string; project_id?: string; email?: string; roles?: string[] };
      const serverState = runtime.workspaceStates[runtime.activeWorkspaceId] ?? runtime.initialState;
      const project = serverState.projects.find((item) => item.id === body.project_id);
      const workspace = runtime.mockWorkspaces.find((item) => item.id === (body.workspace_id ?? runtime.activeWorkspaceId));
      const now = new Date().toISOString();
      const invitation = {
        id: `project_invitation_${runtime.projectInvitations.length + 1}`,
        workspace_id: workspace?.id ?? body.workspace_id ?? runtime.activeWorkspaceId,
        workspace_name: workspace?.name ?? "E2E 工作区",
        project_id: body.project_id ?? "",
        project_name: project?.name ?? "未知项目",
        inviter_account_id: runtime.initialState.auth.account?.id ?? "account_owner",
        inviter_name: runtime.initialState.auth.account?.name ?? "项目负责人",
        inviter_email: runtime.initialState.auth.account?.email ?? "owner@example.com",
        invitee_account_id: `account_${body.email ?? "invitee"}`,
        invitee_email: body.email ?? "",
        roles: body.roles ?? ["executor"],
        status: "pending" as const,
        created_at: now,
        updated_at: now,
      };
      runtime.projectInvitations.push(invitation);
      await fulfillJson(route, { invitation });
      return true;
    }

    await fulfillJson(route, { invitations: runtime.projectInvitations });
    return true;
  }

  return false;
};
