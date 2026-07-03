import type { ProjectInvitation, ProjectMemberRole, SyncState, WorkspaceInvitation } from "./types";
import type { ProjectInvitationResponse, ProjectInvitationsResponse, WorkspaceInvitationResponse, WorkspaceInvitationsResponse } from "./syncInvitationTypes";
import { apiUrl, authHeaders, requestJson } from "./syncHttp";
import { mapProjectInvitation, mapWorkspaceInvitation } from "./syncMappers";

export async function fetchWorkspaceInvitations(sync: SyncState, token: string): Promise<WorkspaceInvitation[]> {
  const payload = await requestJson<WorkspaceInvitationsResponse>(apiUrl(sync.serverUrl, "/workspace-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapWorkspaceInvitation);
}

export async function inviteWorkspaceMember(
  sync: SyncState,
  token: string,
  workspaceId: string,
  email: string,
): Promise<WorkspaceInvitation> {
  const payload = await requestJson<WorkspaceInvitationResponse>(apiUrl(sync.serverUrl, "/workspace-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      email,
    }),
  });
  return mapWorkspaceInvitation(payload.invitation);
}

export async function acceptWorkspaceInvitation(sync: SyncState, token: string, invitationId: string): Promise<WorkspaceInvitation> {
  const payload = await requestJson<WorkspaceInvitationResponse>(
    apiUrl(sync.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  return mapWorkspaceInvitation(payload.invitation);
}

export async function fetchProjectInvitations(sync: SyncState, token: string): Promise<ProjectInvitation[]> {
  const payload = await requestJson<ProjectInvitationsResponse>(apiUrl(sync.serverUrl, "/project-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapProjectInvitation);
}

export async function inviteProjectMember(
  sync: SyncState,
  token: string,
  input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] },
): Promise<ProjectInvitation> {
  const payload = await requestJson<ProjectInvitationResponse>(apiUrl(sync.serverUrl, "/project-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      email: input.email,
      roles: input.roles.length ? input.roles : ["executor"],
    }),
  });
  return mapProjectInvitation(payload.invitation);
}

export async function acceptProjectInvitation(sync: SyncState, token: string, invitationId: string): Promise<ProjectInvitation> {
  const payload = await requestJson<ProjectInvitationResponse>(
    apiUrl(sync.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
    },
  );
  return mapProjectInvitation(payload.invitation);
}
