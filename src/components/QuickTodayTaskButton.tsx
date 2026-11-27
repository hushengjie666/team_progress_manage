import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus } from "lucide-react";
import { accessibleProjectIdsForCurrentUser } from "../accessControl";
import type { AppTaskActionsRuntime } from "../appTaskActionsTypes";
import type { AppState } from "../types";
import { FocusQuickTaskDialog, type FocusQuickTaskRecovery } from "./focus/FocusQuickTaskDialog";

export function QuickTodayTaskButton({ state, defaultWorkspaceId, defaultProjectId, taskActions }: {
  state: AppState;
  defaultWorkspaceId?: string;
  defaultProjectId?: string;
  taskActions: Pick<AppTaskActionsRuntime, "createProjectTask" | "commitTask">;
}) {
  const [open, setOpen] = useState(false);
  const [recovery, setRecovery] = useState<FocusQuickTaskRecovery>();
  const sessionRef = useRef(0);
  const session = sessionRef.current;
  const accessible = accessibleProjectIdsForCurrentUser(state);
  const projects = state.projects.filter((project) => accessible.has(project.id) && !project.archivedAt);

  return <>
    <button type="button" className="icon-button small" aria-label="快捷新增今日任务"
      title={projects.length ? "快捷新增今日任务" : "暂无可用项目，请先创建项目"}
      disabled={!projects.length} onClick={() => {
        sessionRef.current += 1;
        setRecovery(undefined);
        setOpen(true);
      }}>
      <Plus size={20} />
    </button>
    {open && createPortal(<FocusQuickTaskDialog
      key={session} state={state} projects={projects} defaultWorkspaceId={defaultWorkspaceId}
      defaultProjectId={defaultProjectId} taskActions={taskActions} recovery={recovery}
      onClose={() => setOpen(false)}
      onQueueFailure={(failed) => {
        if (sessionRef.current !== session) return;
        sessionRef.current += 1;
        setRecovery(failed);
        setOpen(true);
      }}
    />, document.body)}
  </>;
}
