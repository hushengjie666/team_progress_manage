import type { BackendConnectionState, Workspace, WorkspaceMembership, WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "./types";
import type { AuthSession, LoginResponse } from "./teamBackendAuthTypes";
import type { WorkspaceMembershipResponse, WorkspaceResponse, WorkspacesResponse } from "./teamBackendWorkspaceTypes";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";
import { mapWorkspace, mapWorkspaceMembership, sessionFromLogin } from "./teamBackendMappers";

export async function createWorkspace(backend: BackendConnectionState, token: string, name: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(backend.serverUrl, "/workspaces"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      type: "shared",
      device_id: backend.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function fetchWorkspaces(backend: BackendConnectionState, token: string): Promise<{ workspaces: Workspace[]; memberships: WorkspaceMembership[] }> {
  const payload = await requestJson<WorkspacesResponse>(apiUrl(backend.serverUrl, "/workspaces"), {
    headers: authHeaders(token),
  });
  return {
    workspaces: payload.workspaces.map(mapWorkspace),
    memberships: (payload.memberships ?? []).map(mapWorkspaceMembership),
  };
}

export async function updateWorkspace(
  backend: BackendConnectionState,
  token: string,
  workspaceId: string,
  input: WorkspaceUpdateInput,
): Promise<Workspace> {
  const payload = await requestJson<WorkspaceResponse>(apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? "shared",
      owner_account_id: input.ownerAccountId,
    }),
  });
  return mapWorkspace(payload.workspace);
}

export async function updateWorkspaceMembership(
  backend: BackendConnectionState,
  token: string,
  workspaceId: string,
  membershipId: string,
  input: WorkspaceMembershipUpdateInput,
): Promise<WorkspaceMembership> {
  const payload = await requestJson<WorkspaceMembershipResponse>(
    apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`),
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        status: input.status,
        role: input.role,
      }),
    },
  );
  return mapWorkspaceMembership(payload.membership);
}
