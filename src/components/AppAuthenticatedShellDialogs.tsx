import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { QuickProjectCreateModal } from "./QuickProjectCreateModal";
import { MiniTimer } from "./focus/MiniTimer";
import { CommandPalette } from "./CommandPalette";
import { ConfirmDialog, ShortcutHelpDialog, SplitTaskDialog } from "./Dialogs";
import { isTauriRuntime } from "../tauriEnvironment";
import { filterProjectItemsForWorkspace, projectIdsForWorkspace } from "../workspaceScope";

type AppAuthenticatedShellDialogsProps = Pick<
  AppAuthenticatedShellProps,
  | "view"
  | "shellState"
  | "chrome"
  | "taskActions"
  | "focusActions"
  | "closeQuickProjectCreate"
  | "submitQuickProjectCreate"
  | "runCommand"
>;

export function AppAuthenticatedShellDialogs({
  view,
  shellState,
  chrome,
  taskActions,
  focusActions,
  closeQuickProjectCreate,
  submitQuickProjectCreate,
  runCommand,
}: AppAuthenticatedShellDialogsProps) {
  const {
    state,
    tab,
    currentTask,
    visibleWorkspaces,
  } = view;
  const {
    quickProjectCreateOpen,
    quickProjectDraft,
    setQuickProjectDraft,
    quickProjectWarning,
    setQuickProjectWarning,
    pendingDeleteTask,
    setPendingDeleteTask,
    deletedTaskSnapshot,
    pendingReset,
    setPendingReset,
    pendingSplit,
    setPendingSplit,
    commandPaletteOpen,
    setCommandPaletteOpen,
    showShortcutHelp,
    setShowShortcutHelp,
  } = shellState;
  const commandTasks = shellState.selectedWorkspaceId
    ? filterProjectItemsForWorkspace(state.tasks, projectIdsForWorkspace(state, shellState.selectedWorkspaceId))
    : state.tasks;

  return (
    <>
      <QuickProjectCreateModal
        open={quickProjectCreateOpen}
        draft={quickProjectDraft}
        setDraft={setQuickProjectDraft}
        warning={quickProjectWarning}
        setWarning={setQuickProjectWarning}
        workspaces={visibleWorkspaces}
        defaultWorkspaceId={chrome.defaultQuickProjectWorkspaceId}
        onClose={closeQuickProjectCreate}
        onSubmit={submitQuickProjectCreate}
      />
      {state.activeTimer && tab !== "focus" && !isTauriRuntime() && (
        <MiniTimer
          state={state}
          task={currentTask}
          toggleTimer={focusActions.toggleTimer}
          finishTimer={focusActions.finishTimer}
        />
      )}
      {deletedTaskSnapshot && (
        <div className="undo-banner" role="status">
          <span>已删除「{deletedTaskSnapshot.task.title}」</span>
          <button className="small-button" onClick={taskActions.undoDeleteTask}>
            撤销
          </button>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteTask)}
        title="删除任务"
        body={pendingDeleteTask ? `确认删除「${pendingDeleteTask.title}」吗？删除后会从工作队列和团队后台中移除。` : ""}
        confirmLabel="删除"
        danger
        onCancel={() => setPendingDeleteTask(null)}
        onConfirm={taskActions.confirmDeleteTask}
      />
      <ConfirmDialog
        open={pendingReset}
        title="重置当前计时"
        body="重置会把当前计时恢复到完整时长，并暂停计时。"
        confirmLabel="重置"
        onCancel={() => setPendingReset(false)}
        onConfirm={focusActions.confirmResetTimer}
      />
      <SplitTaskDialog
        draft={pendingSplit}
        setDraft={setPendingSplit}
        onCancel={() => setPendingSplit(null)}
        onConfirm={taskActions.confirmSplitTask}
      />
      <ShortcutHelpDialog open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      <CommandPalette
        open={commandPaletteOpen}
        tasks={commandTasks}
        onClose={() => setCommandPaletteOpen(false)}
        onRun={runCommand}
      />
    </>
  );
}
