import type { SyncState } from "./types";

export const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

export const withStatus = (sync: SyncState, patch: Partial<SyncState>): SyncState => ({
  ...sync,
  ...patch,
  tombstones: patch.tombstones ?? sync.tombstones ?? [],
});

export const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};

export const requestJson = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  try {
    const response = await fetch(input, init);
    return readResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("无法连接团队后台，请检查服务地址是否正确，并确认后台服务已启动");
    }
    throw error;
  }
};
