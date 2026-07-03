import type { Account, ProjectMember, SyncState } from "./types";
import type { MemberAccountPayload, MemberResponse, PlatformAccountPayload, PlatformAccountResponse, PlatformAccountsResponse } from "./syncAdminTypes";
import { apiUrl, authHeaders, requestJson } from "./syncHttp";
import { mapAccount } from "./syncMappers";

export async function fetchPlatformAccounts(sync: SyncState, token: string): Promise<Account[]> {
  const payload = await requestJson<PlatformAccountsResponse>(apiUrl(sync.serverUrl, "/admin/accounts"), {
    headers: authHeaders(token),
  });
  return payload.accounts.map(mapAccount);
}

export async function createPlatformAccount(
  sync: SyncState,
  token: string,
  payload: Required<Pick<PlatformAccountPayload, "name" | "email" | "password">> & Pick<PlatformAccountPayload, "status">,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(sync.serverUrl, "/admin/accounts"), {
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
  sync: SyncState,
  token: string,
  accountId: string,
  payload: PlatformAccountPayload,
): Promise<Account> {
  const result = await requestJson<PlatformAccountResponse>(apiUrl(sync.serverUrl, `/admin/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
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

export async function createMemberAccount(sync: SyncState, token: string, payload: MemberAccountPayload): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, "/members"), {
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
  sync: SyncState,
  token: string,
  memberId: string,
  payload: Partial<Omit<MemberAccountPayload, "projectId">>,
): Promise<ProjectMember> {
  const result = await requestJson<MemberResponse>(apiUrl(sync.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      workspace_id: payload.workspaceId,
      email: payload.email,
      password: payload.password,
      roles: payload.roles,
    }),
  });
  return result.member.payload as ProjectMember;
}
