const mountedApiBaseFromBuiltAssets = (origin: string) => {
  const script = document.querySelector<HTMLScriptElement>('script[type="module"][src*="/assets/"]');
  const src = script?.getAttribute("src");
  if (!src) return "";
  const scriptPath = new URL(src, origin).pathname;
  const assetsIndex = scriptPath.indexOf("/assets/");
  if (assetsIndex <= 0) return "";
  const basePath = scriptPath.slice(0, assetsIndex).replace(/\/+$/, "");
  return basePath ? `${origin}${basePath}/api` : "";
};

export const defaultBackendServerUrl = () => {
  if (typeof window === "undefined") return "http://127.0.0.1:8787";
  const { protocol, hostname, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    if (!isLocalHost) return mountedApiBaseFromBuiltAssets(origin) || origin;
  }
  return "http://127.0.0.1:8787";
};
