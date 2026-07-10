import type { ProjectInvitation, ProjectMemberRole, BackendConnectionState, WorkspaceInvitation } from "./types";
import type { ProjectInvitationResponse, ProjectInvitationsResponse, WorkspaceInvitationResponse, WorkspaceInvitationsResponse } from "./teamBackendInvitationTypes";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";
import { mapProjectInvitation, mapWorkspaceInvitation } from "./teamBackendMappers";

export async function fetchWorkspaceInvitations(backend: BackendConnectionState, token: string): Promise<WorkspaceInvitation[]> {
  const payload = await requestJson<WorkspaceInvitationsResponse>(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapWorkspaceInvitation);
}

export async function inviteWorkspaceMember(
  backend: BackendConnectionState,
  token: string,
  workspaceId: string,
  email: string,
): Promise<WorkspaceInvitation> {
  const payload = await requestJson<WorkspaceInvitationResponse>(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      email,
    }),
  });
  return mapWorkspaceInvitation(payload.invitation);
}

export async function acceptWorkspaceInvitation(backend: BackendConnectionState, token: string, invitationId: string, expectedRevision?: number): Promise<WorkspaceInvitation> {
  const revision = expectedRevision ?? (await fetchWorkspaceInvitations(backend, token)).find((item) => item.id === invitationId)?.revision;
  if (!revision) throw new Error("邀请版本已失效，请刷新后重试");
  const payload = await requestJson<WorkspaceInvitationResponse>(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
  return mapWorkspaceInvitation(payload.invitation);
}

export async function deleteWorkspaceInvitation(backend: BackendConnectionState, token: string, invitationId: string, expectedRevision?: number): Promise<WorkspaceInvitation> {
  const revision = expectedRevision ?? (await fetchWorkspaceInvitations(backend, token)).find((item) => item.id === invitationId)?.revision;
  if (!revision) throw new Error("邀请版本已失效，请刷新后重试");
  const payload = await requestJson<WorkspaceInvitationResponse>(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
  return mapWorkspaceInvitation(payload.invitation);
}

export async function fetchProjectInvitations(backend: BackendConnectionState, token: string): Promise<ProjectInvitation[]> {
  const payload = await requestJson<ProjectInvitationsResponse>(apiUrl(backend.serverUrl, "/project-invitations"), {
    headers: authHeaders(token),
  });
  return payload.invitations.map(mapProjectInvitation);
}

export async function inviteProjectMember(
  backend: BackendConnectionState,
  token: string,
  input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] },
): Promise<ProjectInvitation> {
  const payload = await requestJson<ProjectInvitationResponse>(apiUrl(backend.serverUrl, "/project-invitations"), {
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

export async function deleteProjectInvitation(backend: BackendConnectionState, token: string, invitationId: string, expectedRevision?: number): Promise<ProjectInvitation> {
  const revision = expectedRevision ?? (await fetchProjectInvitations(backend, token)).find((item) => item.id === invitationId)?.revision;
  if (!revision) throw new Error("邀请版本已失效，请刷新后重试");
  const payload = await requestJson<ProjectInvitationResponse>(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token),
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
  return mapProjectInvitation(payload.invitation);
}

export async function acceptProjectInvitation(backend: BackendConnectionState, token: string, invitationId: string, expectedRevision?: number): Promise<ProjectInvitation> {
  const revision = expectedRevision ?? (await fetchProjectInvitations(backend, token)).find((item) => item.id === invitationId)?.revision;
  if (!revision) throw new Error("邀请版本已失效，请刷新后重试");
  const payload = await requestJson<ProjectInvitationResponse>(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token),
      body: JSON.stringify({ expected_revision: revision }),
    },
  );
  return mapProjectInvitation(payload.invitation);
}
