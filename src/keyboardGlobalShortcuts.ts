import { getTodayPlan, type Tab } from "./appModel";
import type { AppState } from "./types";
import type { KeyboardRuntimeOptions } from "./keyboardRuntime";

export const isEditingTarget = (target: EventTarget | null) => {
  const element = target as HTMLElement | null;
  return element?.tagName === "INPUT" || element?.tagName === "TEXTAREA" || element?.tagName === "SELECT";
};

export function handleGlobalKeyboardShortcut(
  event: KeyboardEvent,
  options: KeyboardRuntimeOptions,
  current: AppState | null,
  currentTab: Tab,
  editing: boolean,
) {
  const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    options.setCommandPaletteOpen(true);
    return true;
  }
  if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
    if (event.key === "1") {
      event.preventDefault();
      options.setSettingsSection("members");
      options.setTab("settings");
      return true;
    }
    if (event.key === "2") {
      event.preventDefault();
      options.setWorkspaceMode("board");
      options.setTab("workspace");
      return true;
    }
    if (event.key === "3") {
      event.preventDefault();
      options.setWorkspaceMode("workbench");
      options.setTab("workspace");
      return true;
    }
    if (event.key === "4") {
      event.preventDefault();
      options.setTab("calendar");
      return true;
    }
    if (event.key === "5") {
      event.preventDefault();
      options.setTab("daily");
      return true;
    }
    if (event.key === "6") {
      event.preventDefault();
      options.setTab("reports");
      return true;
    }
  }
  if (event.key === "Escape") {
    options.setCommandPaletteOpen(false);
    options.setShowShortcutHelp(false);
    return true;
  }
  if (!editing && isSlash) {
    event.preventDefault();
    options.setCommandPaletteOpen(true);
    return true;
  }
  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
    event.preventDefault();
    const plan = current ? getTodayPlan(current) : null;
    if (current && plan && !plan.reviewedAt && currentTab === "daily") {
      options.completeReview();
    }
    return true;
  }

  return false;
}
