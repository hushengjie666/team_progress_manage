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

export class TeamRequestError extends Error {
  constructor(public readonly kind: "timeout" | "network") {
    super(kind === "timeout"
      ? "团队后台响应超时，请稍后重试或刷新数据确认操作结果"
      : "与团队后台的连接暂时中断，请检查网络后重试或刷新数据确认操作结果");
  }
}

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

const requestJsonOnce = async <T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> => {
  const timeoutController = init?.signal ? undefined : new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    if (timeoutController) {
      timeoutId = setTimeout(() => timeoutController.abort(), REQUEST_TIMEOUT_MS);
    }
    const response = await fetch(input, timeoutController ? { ...init, signal: timeoutController.signal } : init);
    return await readResponse<T>(response);
  } catch (error) {
    if (timeoutController?.signal.aborted) throw new TeamRequestError("timeout");
    if (error instanceof TypeError || (error instanceof DOMException && error.name === "AbortError")) {
      if (init?.signal?.aborted) throw error;
      throw new TeamRequestError("network");
    }
    throw error;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
};

export const requestJson = async <T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: { retry?: boolean } = {},
): Promise<T> => {
  const method = (init?.method ?? "GET").toUpperCase();
  const safeToRetry = method === "GET" || method === "HEAD" || Boolean(new Headers(init?.headers).get("Idempotency-Key"));
  try {
    return await requestJsonOnce<T>(input, init);
  } catch (error) {
    const transient = error instanceof TeamRequestError || error instanceof TeamHttpError && [502, 503, 504].includes(error.status);
    if (!options.retry || !safeToRetry || !transient || init?.signal?.aborted) throw error;
    await new Promise<void>((resolve) => setTimeout(resolve, 400));
    return requestJsonOnce<T>(input, init);
  }
};
