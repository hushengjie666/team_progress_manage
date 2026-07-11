import { Plus, X } from "lucide-react";
import { taskStageModeOptions } from "../appModel";
import type { TaskStageMode, Workspace } from "../types";

export type QuickProjectCreateDraft = {
  name: string;
  description: string;
  workspaceId: string;
  taskStageMode: TaskStageMode;
};

export function QuickProjectCreateModal({
  open,
  draft,
  setDraft,
  warning,
  setWarning,
  workspaces,
  defaultWorkspaceId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: QuickProjectCreateDraft;
  setDraft: (draft: QuickProjectCreateDraft) => void;
  warning: string;
  setWarning: (warning: string) => void;
  workspaces: Workspace[];
  defaultWorkspaceId: string;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open) return null;

  const workspaceOptionLabel = (workspace: Workspace) =>
    `${workspace.type === "private" ? "私人" : "协作"} · ${workspace.name}`;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <section
        className="modal-panel quick-project-create-modal"
        role="dialog"
        aria-modal="true"
        aria-label="新增项目"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">Project</p>
            <h2>新增项目</h2>
            <span>选择项目所属工作区，创建后仍停留在项目总览。</span>
          </div>
          <button className="icon-button" onClick={onClose} aria-label="关闭" type="button">
            <X size={18} />
          </button>
        </div>
        <form
          className="quick-project-create-form"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label>
            项目名称
            <input
              value={draft.name}
              aria-invalid={Boolean(warning && !draft.name.trim())}
              onChange={(event) => {
                setDraft({ ...draft, name: event.target.value });
                if (warning) setWarning("");
              }}
              placeholder="例如：客户交付项目"
              autoFocus
            />
            {warning && <span className="field-error">{warning}</span>}
          </label>
          <label>
            所属工作区
            <select
              value={draft.workspaceId || defaultWorkspaceId}
              onChange={(event) => setDraft({ ...draft, workspaceId: event.target.value })}
            >
              {workspaces.map((workspace) => (
                <option key={workspace.id} value={workspace.id}>{workspaceOptionLabel(workspace)}</option>
              ))}
            </select>
          </label>
          <label>
            项目类型
            <select
              value={draft.taskStageMode}
              onChange={(event) => setDraft({ ...draft, taskStageMode: event.target.value as TaskStageMode })}
            >
              {taskStageModeOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            项目说明
            <textarea
              value={draft.description}
              onChange={(event) => setDraft({ ...draft, description: event.target.value })}
              placeholder="这个项目要达成什么"
            />
          </label>
          <div className="modal-actions">
            <button className="secondary-button" onClick={onClose} type="button">
              取消
            </button>
            <button className="primary-button" disabled={!workspaces.length} type="submit">
              <Plus size={16} />
              添加项目
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
