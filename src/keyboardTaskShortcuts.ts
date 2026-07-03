import { getTodayPlan, type Tab } from "./appModel";
import type { AppState } from "./types";
import type { KeyboardRuntimeOptions } from "./keyboardRuntime";

const selectedCommittedTaskId = (committedIds: string[], selectedTaskId: string | null) =>
  selectedTaskId && committedIds.includes(selectedTaskId)
    ? selectedTaskId
    : committedIds[0];

export function handleTaskKeyboardShortcut(
  event: KeyboardEvent,
  options: KeyboardRuntimeOptions,
  current: AppState,
  currentTab: Tab,
) {
  if (event.code === "Space" || event.key === " ") {
    event.preventDefault();
    if (event.shiftKey) {
      if (current.activeTimer) options.setPendingReset(true);
      return true;
    }
    if (!current.activeTimer) {
      if (currentTab !== "workspace") return true;
      const plan = getTodayPlan(current);
      const selected = selectedCommittedTaskId(plan.committedTaskIds, options.getSelectedTaskId());
      if (selected) {
        options.setTab("focus");
        void options.beginTimer("focus", selected);
      }
      return true;
    }
    options.toggleTimer();
    return true;
  }

  const plan = getTodayPlan(current);
  const committedIds = plan.committedTaskIds;

  if (currentTab === "workspace" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
    event.preventDefault();
    const direction: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
    const currentSelected = options.getSelectedTaskId();
    if (!committedIds.length) return true;

    const selectedId = selectedCommittedTaskId(committedIds, currentSelected);
    if (!selectedId) return true;
    options.setSelectedTaskId(selectedId);

    if (currentSelected && committedIds.includes(currentSelected)) {
      const currentIndex = committedIds.indexOf(currentSelected);
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= committedIds.length) return true;
      options.moveCommittedTask(currentSelected, direction);
      options.setSelectedTaskId(committedIds[nextIndex]);
    }
    return true;
  }

  if (event.key === "Enter" && currentTab === "workspace" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
    event.preventDefault();
    const selected = selectedCommittedTaskId(committedIds, options.getSelectedTaskId());
    if (!selected || current.activeTimer) return true;
    options.setTab("focus");
    void options.beginTimer("focus", selected);
    return true;
  }

  if (event.key === "q" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && currentTab === "focus") {
    event.preventDefault();
    options.setTab("workspace");
    return true;
  }

  return false;
}
