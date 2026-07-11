import { useEffect } from "react";
import type { Tab } from "./appModel";
import type { ProjectDetailTab } from "./components/ProjectDetailView";

export function useMobileNavigationScroll(tab: Tab, workspaceMode: string, projectDetailTab: ProjectDetailTab) {
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(max-width: 820px), (max-width: 960px) and (max-height: 600px)").matches) return;
    window.scrollTo({ top: 0, behavior: "auto" });
  }, [tab, workspaceMode, projectDetailTab]);
}
