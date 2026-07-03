import { useEffect } from "react";
import { createKeyboardRuntime } from "./keyboardRuntime";
import type { useAppShellState } from "./appShellState";
import type { SessionMode } from "./types";

type AppShellSource = ReturnType<typeof useAppShellState>;

export function useAppKeyboardShortcuts({
  shell,
  completeReview,
  beginTimer,
  toggleTimer,
  moveCommittedTask,
}: {
  shell: AppShellSource;
  completeReview: () => void;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
}) {
  useEffect(() => createKeyboardRuntime({
    getState: () => shell.stateRef.current,
    getCurrentTab: () => shell.tabRef.current,
    getSelectedTaskId: () => shell.selectedTaskIdRef.current,
    setCommandPaletteOpen: shell.setCommandPaletteOpen,
    setShowShortcutHelp: shell.setShowShortcutHelp,
    setSettingsSection: shell.setSettingsSection,
    setWorkspaceMode: shell.setWorkspaceMode,
    setTab: shell.setTab,
    setPendingReset: shell.setPendingReset,
    setSelectedTaskId: shell.setSelectedTaskId,
    completeReview,
    beginTimer,
    toggleTimer,
    moveCommittedTask,
  }).attach(), []);
}
