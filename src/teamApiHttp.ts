export const teamApiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

export const teamAuthHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

export const readTeamResponse = async <T>(response: Response): Promise<T> => {
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
