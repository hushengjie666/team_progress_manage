import type { SyncState, Workspace, WorkspaceMembership, WorkspaceMembershipUpdateInput, WorkspaceUpdateInput } from "./types";
import type { AuthSession, LoginResponse } from "./syncAuthTypes";
import type { WorkspaceMembershipResponse, WorkspaceResponse, WorkspacesResponse } from "./syncWorkspaceTypes";
import { apiUrl, authHeaders, requestJson } from "./syncHttp";
import { mapWorkspace, mapWorkspaceMembership, sessionFromLogin } from "./syncMappers";

export async function createWorkspace(sync: SyncState, token: string, name: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/workspaces"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      type: "shared",
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function fetchWorkspaces(sync: SyncState, token: string): Promise<{ workspaces: Workspace[]; memberships: WorkspaceMembership[] }> {
  const payload = await requestJson<WorkspacesResponse>(apiUrl(sync.serverUrl, "/workspaces"), {
    headers: authHeaders(token),
  });
  return {
    workspaces: payload.workspaces.map(mapWorkspace),
    memberships: (payload.memberships ?? []).map(mapWorkspaceMembership),
  };
}

export async function updateWorkspace(
  sync: SyncState,
  token: string,
  workspaceId: string,
  input: WorkspaceUpdateInput,
): Promise<Workspace> {
  const payload = await requestJson<WorkspaceResponse>(apiUrl(sync.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}`), {
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
  sync: SyncState,
  token: string,
  workspaceId: string,
  membershipId: string,
  input: WorkspaceMembershipUpdateInput,
): Promise<WorkspaceMembership> {
  const payload = await requestJson<WorkspaceMembershipResponse>(
    apiUrl(sync.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`),
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        status: input.status,
      }),
    },
  );
  return mapWorkspaceMembership(payload.membership);
}
