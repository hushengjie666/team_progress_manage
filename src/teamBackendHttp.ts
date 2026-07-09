import type { BackendConnectionState } from "./types";

export const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

export const withStatus = (backend: BackendConnectionState, patch: Partial<BackendConnectionState>): BackendConnectionState => ({
  ...backend,
  ...patch,
});

export const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const REQUEST_TIMEOUT_MS = 8_000;

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
  const timeoutController = init?.signal ? undefined : new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    }
    const response = await fetch(input, timeoutController ? { ...init, signal: timeoutController.signal } : init);
    return readResponse<T>(response);
  } catch (error) {
    if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) {
      throw new Error("无法连接团队后台，请检查服务地址是否正确，并确认后台服务已启动");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};
