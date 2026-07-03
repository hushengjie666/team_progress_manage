import { type Tab } from "./appModel";
import type { AppState, SessionMode } from "./types";
import { handleGlobalKeyboardShortcut, isEditingTarget } from "./keyboardGlobalShortcuts";
import { handleTaskKeyboardShortcut } from "./keyboardTaskShortcuts";

export type KeyboardRuntimeOptions = {
  getState: () => AppState | null;
  getCurrentTab: () => Tab;
  getSelectedTaskId: () => string | null;
  setCommandPaletteOpen: (open: boolean) => void;
  setShowShortcutHelp: (open: boolean) => void;
  setSettingsSection: (section: "members") => void;
  setWorkspaceMode: (mode: "board" | "workbench") => void;
  setTab: (tab: Tab) => void;
  setPendingReset: (pending: boolean) => void;
  setSelectedTaskId: (taskId: string) => void;
  completeReview: () => void;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
};

export const createKeyboardRuntime = (options: KeyboardRuntimeOptions) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const current = options.getState();
    const currentTab = options.getCurrentTab();
    const editing = isEditingTarget(event.target);
    if (handleGlobalKeyboardShortcut(event, options, current, currentTab, editing)) return;
    if (editing || !current) return;
    handleTaskKeyboardShortcut(event, options, current, currentTab);
  };

  return {
    attach(target: Pick<Window, "addEventListener" | "removeEventListener"> = window) {
      target.addEventListener("keydown", handleKeyDown);
      return () => target.removeEventListener("keydown", handleKeyDown);
    },
  };
};
