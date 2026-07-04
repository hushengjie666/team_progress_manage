export const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

export const timed = async <T>(runner: () => Promise<T>) => {
  const start = performance.now();
  const result = await runner();
  return { result, latencyMs: Math.round(performance.now() - start) };
};

export const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = "团队接口请求失败";
  try {
    const payload = await response.json() as { error?: string };
    message = payload.error ?? message;
  } catch {
    // keep default message
  }
  throw new Error(message);
};
