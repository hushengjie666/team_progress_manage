import { useEffect } from "react";
import type { Tab } from "./appModel";
import { platformCapabilities } from "./platformCapabilities";

type TabSetter = (tab: Tab) => void;

const routeURLs = (urls: string[], setTab: TabSetter) => {
  for (const value of urls) {
    try {
      const url = new URL(value);
      if (url.protocol === "timemanage:" && (url.hostname === "focus" || url.pathname === "/focus")) {
        setTab("focus");
        return;
      }
    } catch {
      // Ignore malformed external URLs.
    }
  }
};

export function useIOSDeepLinks(setTab: TabSetter) {
  useEffect(() => {
    if (!platformCapabilities().isIOS) return undefined;
    let disposed = false;
    let unlisten: (() => void) | undefined;
    void import("@tauri-apps/plugin-deep-link").then(async ({ getCurrent, onOpenUrl }) => {
      const current = await getCurrent();
      if (!disposed && current) routeURLs(current, setTab);
      const remove = await onOpenUrl((urls) => routeURLs(urls, setTab));
      if (disposed) remove();
      else unlisten = remove;
    }).catch((error) => console.error("Failed to attach iOS deep links", error));
    return () => {
      disposed = true;
      unlisten?.();
    };
  }, [setTab]);
}
