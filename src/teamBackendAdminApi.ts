import type { Account, ProjectMember, BackendConnectionState } from "./types";
import type { MemberAccountPayload, MemberResponse, PlatformAccountPayload, PlatformAccountResponse, PlatformAccountsResponse } from "./teamBackendAdminTypes";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";
import { mapAccount } from "./teamBackendMappers";

export async function fetchPlatformAccounts(backend: BackendConnectionState, token: string): Promise<Account[]> {
  const payload = await requestJson<PlatformAccountsResponse>(apiUrl(backend.serverUrl, "/admin/accounts"), {
    headers: authHeaders(token),
  });
  return payload.accounts.map(mapAccount);
}

export async function createPlatformAccount(
  backend: BackendConnectionState,
  token: string,
  payload: Required<Pick<PlatformAccountPayload, "name" | "email" | "password">> & Pick<PlatformAccountPayload, "status">,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(backend.serverUrl, "/admin/accounts"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status,
    }),
  });
  return mapAccount(result.account);
}

export async function updatePlatformAccount(
  backend: BackendConnectionState,
  token: string,
  accountId: string,
  payload: PlatformAccountPayload,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(backend.serverUrl, `/admin/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status,
      expected_revision: payload.expectedRevision,
    }),
  });
  return mapAccount(result.account);
}

export async function createMemberAccount(backend: BackendConnectionState, token: string, payload: MemberAccountPayload): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(backend.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: payload.projectId,
      workspace_id: payload.workspaceId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
}

export async function updateMemberAccount(
  backend: BackendConnectionState,
  token: string,
  memberId: string,
  payload: Partial<Omit<MemberAccountPayload, "projectId">>,
): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(backend.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      workspace_id: payload.workspaceId,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
      expected_revision: payload.expectedRevision,
    }),
  });
  return result.member.payload as ProjectMember;
}
