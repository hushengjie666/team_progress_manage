import { useState } from "react";
import { Trash2 } from "lucide-react";
import { createPortal } from "react-dom";
import { ConfirmDialog } from "./Dialogs";

export function ProjectDeleteButton(props: {
  projectId: string;
  projectName: string;
  taskCount: number;
  deleteProject: (projectId: string) => Promise<boolean>;
  onDeleted?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const confirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      if (await props.deleteProject(props.projectId)) {
        setOpen(false);
        props.onDeleted?.();
      } else {
        setError("删除失败，请检查连接或权限后重试。");
      }
    } catch {
      setError("删除失败，请稍后重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()} onPointerDown={(event) => event.stopPropagation()}>
      <button className="secondary-button danger-button" type="button" onClick={() => { setError(""); setOpen(true); }}>
        <Trash2 size={16} />
        删除项目
      </button>
      {open && createPortal(<ConfirmDialog
        open={open}
        title="删除项目"
        body={`确认删除「${props.projectName}」吗？该项目及其 ${props.taskCount} 个任务、成员关联、工作与专注记录将一并永久删除。此操作不可撤销。`}
        confirmLabel={busy ? "正在删除…" : "删除项目及任务"}
        danger
        busy={busy}
        error={error}
        onCancel={() => setOpen(false)}
        onConfirm={() => { void confirmDelete(); }}
      />, document.body)}
    </div>
  );
}
