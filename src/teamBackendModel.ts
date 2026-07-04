import { defaultBackendServerUrl } from "./seed";

export const shouldUseRemoteOriginForBackend = (serverUrl: string) => {
  const remoteUrl = defaultBackendServerUrl();
  if (remoteUrl === "http://127.0.0.1:8787") return false;
  try {
    const parsed = new URL(serverUrl);
    if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost" || parsed.hostname === "::1") return true;
    return parsed.hostname.endsWith("trycloudflare.com") && parsed.origin !== remoteUrl;
  } catch {
    return true;
  }
};
