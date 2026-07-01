import { getTodayPlan, type Tab } from "./appModel";
import type { AppState, SessionMode } from "./types";

export type KeyboardRuntimeOptions = {
  getState: () => AppState | null;
  getCurrentTab: () => Tab;
  getSelectedTaskId: () => string | null;
  setCommandPaletteOpen: (open: boolean) => void;
  setShowShortcutHelp: (open: boolean) => void;
  setSettingsSection: (section: "projects") => void;
  setWorkspaceMode: (mode: "board" | "workbench") => void;
  setTab: (tab: Tab) => void;
  setPendingReset: (pending: boolean) => void;
  setSelectedTaskId: (taskId: string) => void;
  completeReview: () => void;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
};

const isEditingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.tagName === "SELECT";
};

export const createKeyboardRuntime = (options: KeyboardRuntimeOptions) => {
  const handleKeyDown = (event: KeyboardEvent) => {
    const current = options.getState();
    const currentTab = options.getCurrentTab();
    const editing = isEditingTarget(event.target);
    const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      options.setCommandPaletteOpen(true);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
      if (event.key === "1") {
        event.preventDefault();
        options.setSettingsSection("projects");
        options.setTab("settings");
        return;
      }
      if (event.key === "2") {
        event.preventDefault();
        options.setWorkspaceMode("board");
        options.setTab("workspace");
        return;
      }
      if (event.key === "3") {
        event.preventDefault();
        options.setWorkspaceMode("workbench");
        options.setTab("workspace");
        return;
      }
      if (event.key === "4") {
        event.preventDefault();
        options.setTab("calendar");
        return;
      }
      if (event.key === "5") {
        event.preventDefault();
        options.setTab("daily");
        return;
      }
      if (event.key === "6") {
        event.preventDefault();
        options.setTab("reports");
        return;
      }
    }
    if (event.key === "Escape") {
      options.setCommandPaletteOpen(false);
      options.setShowShortcutHelp(false);
      return;
    }
    if (!editing && isSlash) {
      event.preventDefault();
      options.setCommandPaletteOpen(true);
      return;
    }
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      const plan = current ? getTodayPlan(current) : null;
      if (current && plan && !plan.reviewedAt && currentTab === "daily") {
        options.completeReview();
      }
      return;
    }

    if (editing || !current) return;

    if (event.code === "Space" || event.key === " ") {
      event.preventDefault();
      if (event.shiftKey) {
        if (current.activeTimer) options.setPendingReset(true);
        return;
      }
      if (!current.activeTimer) {
        if (currentTab !== "workspace") return;
        const plan = getTodayPlan(current);
        const selectedTaskId = options.getSelectedTaskId();
        const selected = selectedTaskId && plan.committedTaskIds.includes(selectedTaskId)
          ? selectedTaskId
          : plan.committedTaskIds[0];
        if (selected) {
          options.setTab("focus");
          void options.beginTimer("focus", selected);
        }
        return;
      }
      options.toggleTimer();
      return;
    }

    const plan = getTodayPlan(current);
    const committedIds = plan.committedTaskIds;

    if (currentTab === "workspace" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
      event.preventDefault();
      const direction: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
      const currentSelected = options.getSelectedTaskId();
      if (!committedIds.length) return;

      const selectedId = currentSelected && committedIds.includes(currentSelected) ? currentSelected : committedIds[0];
      if (!selectedId) return;
      options.setSelectedTaskId(selectedId);

      if (currentSelected && committedIds.includes(currentSelected)) {
        const currentIndex = committedIds.indexOf(currentSelected);
        const nextIndex = currentIndex + direction;
        if (nextIndex < 0 || nextIndex >= committedIds.length) return;
        options.moveCommittedTask(currentSelected, direction);
        options.setSelectedTaskId(committedIds[nextIndex]);
      }
      return;
    }

    if (event.key === "Enter" && currentTab === "workspace" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      const selectedTaskId = options.getSelectedTaskId();
      const selected = selectedTaskId && committedIds.includes(selectedTaskId)
        ? selectedTaskId
        : committedIds[0];
      if (!selected || current.activeTimer) return;
      options.setTab("focus");
      void options.beginTimer("focus", selected);
    }

    if (event.key === "q" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && currentTab === "focus") {
      event.preventDefault();
      options.setTab("workspace");
    }
  };

  return {
    attach(target: Pick<Window, "addEventListener" | "removeEventListener"> = window) {
      target.addEventListener("keydown", handleKeyDown);
      return () => target.removeEventListener("keydown", handleKeyDown);
    },
  };
};
