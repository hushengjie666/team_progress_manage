import type { SyncState } from "./types";
import type { AuthSession, AuthStatusResponse, BootstrapPayload, LoginResponse } from "./syncAuthTypes";
import { apiUrl, authHeaders, requestJson, withStatus } from "./syncHttp";
import { sessionFromLogin } from "./syncMappers";

export async function getAuthStatus(serverUrl: string): Promise<AuthStatusResponse> {
  return requestJson<AuthStatusResponse>(apiUrl(serverUrl, "/auth/status"));
}

export async function bootstrapWorkspace(sync: SyncState, payload: BootstrapPayload): Promise<AuthSession> {
  const payloadResponse = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/bootstrap"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      workspace_name: payload.workspaceName,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payloadResponse);
}

export async function loginToWorkspace(sync: SyncState, email: string, password: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function switchWorkspace(sync: SyncState, token: string, workspaceId: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(sync.serverUrl, "/auth/switch-workspace"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      device_id: sync.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function loginToSyncServer(sync: SyncState, password: string): Promise<SyncState> {
  const payload = await loginToWorkspace(sync, sync.username, password);
  return withStatus(sync, {
    username: payload.account.email,
    token: payload.token,
    status: "idle",
    message: `已登录团队工作区，有效期至 ${new Date(payload.expiresAt).toLocaleString()}`,
  });
}
