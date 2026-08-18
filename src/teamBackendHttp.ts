import type { BackendConnectionState } from "./types";
import { releaseContract } from "./releaseContract";

export const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

export const withStatus = (backend: BackendConnectionState, patch: Partial<BackendConnectionState>): BackendConnectionState => ({
  ...backend,
  ...patch,
});

export const clientHeaders = () => ({
  "Content-Type": "application/json",
  "X-TimeManage-Client-Release": releaseContract.releaseVersion,
  "X-TimeManage-API-Protocol": String(releaseContract.apiProtocolVersion),
});

export const authHeaders = (token?: string) => ({
  ...clientHeaders(),
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const REQUEST_TIMEOUT_MS = 8_000;

export class TeamHttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) {
    if (response.status === 204 || response.headers?.get?.("Content-Length") === "0") return undefined as T;
    return response.json() as Promise<T>;
  }
  let message = `${response.status} ${response.statusText}`;
  let details: Record<string, unknown> | undefined;
  try {
    const body = (await response.json()) as Record<string, unknown>;
    details = body;
    if (typeof body.error === "string") message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new TeamHttpError(response.status, message, typeof details?.code === "string" ? details.code : undefined, details);
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
