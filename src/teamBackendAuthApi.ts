import type { BackendConnectionState } from "./types";
import type { AuthSession, AuthStatusResponse, BootstrapPayload, LoginResponse } from "./teamBackendAuthTypes";
import { apiUrl, authHeaders, requestJson, withStatus } from "./teamBackendHttp";
import { sessionFromLogin } from "./teamBackendMappers";

export async function getAuthStatus(serverUrl: string): Promise<AuthStatusResponse> {
  return requestJson<AuthStatusResponse>(apiUrl(serverUrl, "/auth/status"));
}

export async function bootstrapWorkspace(backend: BackendConnectionState, payload: BootstrapPayload): Promise<AuthSession> {
  const payloadResponse = await requestJson<LoginResponse>(apiUrl(backend.serverUrl, "/auth/bootstrap"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      workspace_name: payload.workspaceName,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      device_id: backend.deviceId,
    }),
  });
  return sessionFromLogin(payloadResponse);
}

export async function loginToWorkspace(backend: BackendConnectionState, email: string, password: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(backend.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: backend.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function switchWorkspace(backend: BackendConnectionState, token: string, workspaceId: string): Promise<AuthSession> {
  const payload = await requestJson<LoginResponse>(apiUrl(backend.serverUrl, "/auth/switch-workspace"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      device_id: backend.deviceId,
    }),
  });
  return sessionFromLogin(payload);
}

export async function loginToBackend(backend: BackendConnectionState, password: string): Promise<BackendConnectionState> {
  const payload = await loginToWorkspace(backend, backend.username, password);
  return withStatus(backend, {
    username: payload.account.email,
    token: payload.token,
    status: "idle",
    message: `已登录团队工作区，有效期至 ${new Date(payload.expiresAt).toLocaleString()}`,
  });
}
