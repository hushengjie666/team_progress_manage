import { emptyTaskDefaults, nowIso, type Tab } from "./appModel";
import { resolveMemberIdForProject } from "./memberIdentity";
import { parseQuickInput } from "./planning";
import { uid } from "./seed";
import type {
  AppState,
  CommandAction,
  InterruptionAction,
  InterruptionType,
  ParsedQuickInput,
  SessionMode,
  Task,
} from "./types";
import type { RunTeamDomainCommand } from "./teamDomainCommands";

export type AppCommandRuntimeOptions = {
  getState: () => AppState;
  getCurrentProjectId: () => string | undefined;
  getCurrentTaskId: () => string | undefined;
  getFirstCommittedTaskId: () => string | undefined;
  runTeamCommand: RunTeamDomainCommand;
  setSelectedTaskId: (taskId: string) => void;
  setWorkspaceMode: (mode: "board" | "workbench") => void;
  setSettingsSection: (section: "members" | "backend") => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setShowShortcutHelp: (open: boolean) => void;
  setTab: (tab: Tab) => void;
  setToast: (message: string) => void;
  openBoard: () => void;
  openWorkbench: () => void;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
};

export type AppCommandRuntime = {
  runCommand: (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => void;
};

export function createAppCommandRuntime({
  getState,
  getCurrentProjectId,
  getCurrentTaskId,
  getFirstCommittedTaskId,
  runTeamCommand,
  setSelectedTaskId,
  setWorkspaceMode,
  setSettingsSection,
  setCommandPaletteOpen,
  setShowShortcutHelp,
  setTab,
  setToast,
  openBoard,
  openWorkbench,
  beginTimer,
  toggleTimer,
  addInterruption,
}: AppCommandRuntimeOptions): AppCommandRuntime {
  const addParsedQuickTask = (parsed: ParsedQuickInput) => {
    const state = getState();
    const currentProjectId = getCurrentProjectId();
    if (!currentProjectId || !state.projects.some((project) => project.id === currentProjectId)) {
      setToast("当前工作区没有可用项目，请先创建项目");
      return;
    }
    const timestamp = nowIso();
    const task: Task = {
      id: uid("task"),
      workspaceId: state.projects.find((project) => project.id === currentProjectId)?.workspaceId ?? state.auth.workspace?.id,
      title: parsed.title,
      notes: "由命令面板自然语言快捷添加。",
      tags: parsed.tags,
      projectId: currentProjectId,
      project: parsed.project ?? "Inbox",
      creatorMemberId: resolveMemberIdForProject(state, currentProjectId),
      priority: parsed.priority ?? "medium",
      severity: "medium",
      stage: "requirements",
      estimatePomodoros: parsed.estimatePomodoros,
      status: "pool",
      ...emptyTaskDefaults(timestamp, Date.now()),
      dueAt: parsed.dueAt,
    };
    void runTeamCommand({ kind: "create", entity: "task", workspaceId: task.workspaceId, payload: task as unknown as Record<string, unknown> })
      .then((saved) => {
        if (!saved) return;
        setSelectedTaskId(task.id);
        setWorkspaceMode("workbench");
        setTab("workspace");
        setToast(`已添加：${task.title}`);
      });
  };

  const runCommand = (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => {
    if (action === "navigate_workspace") openBoard();
    if (action === "navigate_focus") openWorkbench();
    if (action === "navigate_settings") {
      setSettingsSection("members");
      setTab("settings");
    }
    if (action === "open_backend_settings") {
      setSettingsSection("backend");
      setTab("settings");
    }
    if (action === "add_quick_task") addParsedQuickTask(parsed ?? parseQuickInput(""));
    if (action === "open_task" && taskId) {
      setSelectedTaskId(taskId);
      setWorkspaceMode("workbench");
      setTab("workspace");
    }
    if (action === "start_focus") {
      setTab("focus");
      void beginTimer("focus", getCurrentTaskId() ?? getFirstCommittedTaskId());
    }
    if (action === "toggle_timer" && getState().activeTimer) toggleTimer();
    if (action === "record_internal_interruption") addInterruption("internal", "defer");
    if (action === "record_external_interruption") addInterruption("external", "inbox");
    if (action === "open_shortcut_help") setShowShortcutHelp(true);
    setCommandPaletteOpen(false);
  };

  return { runCommand };
}
