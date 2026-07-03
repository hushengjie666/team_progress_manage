import { createAppNavigation } from "./appNavigation";
import type { ProjectDetailTab } from "./components/ProjectDetailView";
import type { SettingsSection } from "./components/settings/settingsTypes";
import type { Tab } from "./appModel";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppNavigationRuntimeOptions = {
  tab: Tab;
  workspaceMode: "board" | "workbench";
  setSettingsSection: Setter<SettingsSection>;
  setTab: Setter<Tab>;
  setWorkspaceMode: Setter<"board" | "workbench">;
  setSelectedProjectId: Setter<string | null>;
  setProjectDetailTab: Setter<ProjectDetailTab>;
  setSelectedTaskId: Setter<string | null>;
};

export function createAppNavigationRuntime({
  tab,
  workspaceMode,
  setSettingsSection,
  setTab,
  setWorkspaceMode,
  setSelectedProjectId,
  setProjectDetailTab,
  setSelectedTaskId,
}: AppNavigationRuntimeOptions) {
  const activeNavKey =
    tab === "workspace" ? workspaceMode : tab === "workspaces" ? "workspaces" : tab === "project" ? "board" : tab === "settings" ? "admin" : tab;

  const openAdmin = (section: SettingsSection = "members") => {
    setSettingsSection(section);
    setTab("settings");
  };
  const openProjectDetail = (projectId: string, detailTab: ProjectDetailTab = "overview") => {
    setSelectedProjectId(projectId);
    setProjectDetailTab(detailTab);
    setSelectedTaskId(null);
    setTab("project");
  };
  const openBoard = () => {
    setWorkspaceMode("board");
    setTab("workspace");
  };
  const openWorkspaces = () => {
    setTab("workspaces");
  };
  const openWorkbench = () => {
    setWorkspaceMode("workbench");
    setTab("workspace");
  };
  const openDailyReview = () => {
    setTab("daily");
  };

  const { topbarNavItems } = createAppNavigation({
    openBoard,
    openWorkspaces,
    openMemberStatus: () => setTab("member_status"),
    openWorkbench,
    openFocus: () => setTab("focus"),
    openDailyReview,
    openReports: () => setTab("reports"),
    openCalendar: () => setTab("calendar"),
    openAdmin: () => openAdmin(),
  });

  return {
    activeNavKey,
    topbarNavItems,
    openAdmin,
    openProjectDetail,
    openBoard,
    openWorkspaces,
    openWorkbench,
    openDailyReview,
  };
}
