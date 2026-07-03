import { useState } from "react";
import type { Tab } from "./appModel";
import type { ProjectDetailTab } from "./components/ProjectDetailView";
import type { QuickProjectCreateDraft } from "./components/QuickProjectCreateModal";
import type { SettingsSection } from "./components/settings/settingsTypes";

export function useAppShellUiState() {
  const [tab, setTab] = useState<Tab>("workspace");
  const [workspaceMode, setWorkspaceMode] = useState<"board" | "workbench">("board");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<ProjectDetailTab>("overview");
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("members");
  const [quickProjectCreateOpen, setQuickProjectCreateOpen] = useState(false);
  const [quickProjectDraft, setQuickProjectDraft] = useState<QuickProjectCreateDraft>({
    name: "",
    description: "",
    workspaceId: "",
    taskStageMode: "regular",
  });
  const [quickProjectWarning, setQuickProjectWarning] = useState("");

  return {
    tab,
    setTab,
    workspaceMode,
    setWorkspaceMode,
    selectedProjectId,
    setSelectedProjectId,
    projectDetailTab,
    setProjectDetailTab,
    toast,
    setToast,
    toastVisible,
    setToastVisible,
    commandPaletteOpen,
    setCommandPaletteOpen,
    showShortcutHelp,
    setShowShortcutHelp,
    settingsSection,
    setSettingsSection,
    quickProjectCreateOpen,
    setQuickProjectCreateOpen,
    quickProjectDraft,
    setQuickProjectDraft,
    quickProjectWarning,
    setQuickProjectWarning,
  };
}
