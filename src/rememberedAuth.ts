export type RememberedAuth = {
  serverUrl: string;
  email: string;
  password?: string;
  savedAt: string;
};

const rememberedAuthKey = "timemanage.remembered_auth.v3";

const normalizeServerUrl = (serverUrl: string) => serverUrl.trim().replace(/\/+$/, "");

const readAllRememberedAuth = (): RememberedAuth[] => {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(rememberedAuthKey) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is RememberedAuth =>
        typeof item?.serverUrl === "string" &&
        typeof item.email === "string" &&
        (item.password === undefined || typeof item.password === "string") &&
        typeof item.savedAt === "string",
    );
  } catch {
    return [];
  }
};

const writeAllRememberedAuth = (items: RememberedAuth[]) => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(rememberedAuthKey, JSON.stringify(items));
};

export const readRememberedAuth = (serverUrl: string): RememberedAuth | undefined => {
  const normalized = normalizeServerUrl(serverUrl);
  return readAllRememberedAuth().find((item) => normalizeServerUrl(item.serverUrl) === normalized);
};

export const saveRememberedAuth = (serverUrl: string, email: string) => {
  const normalized = normalizeServerUrl(serverUrl);
  const next: RememberedAuth = {
    serverUrl: normalized,
    email: email.trim(),
    savedAt: new Date().toISOString(),
  };
  const others = readAllRememberedAuth().filter((item) => normalizeServerUrl(item.serverUrl) !== normalized);
  writeAllRememberedAuth([...others, next]);
};

export const clearRememberedAuth = (serverUrl: string) => {
  const normalized = normalizeServerUrl(serverUrl);
  writeAllRememberedAuth(readAllRememberedAuth().filter((item) => normalizeServerUrl(item.serverUrl) !== normalized));
};
