import { Building2, Plus } from "lucide-react";
import type { WorkspaceDirectoryCard, WorkspaceModalState } from "./workspaceDirectoryModel";
import { workspaceTypeLabel } from "./workspaceDirectoryModel";

export function WorkspaceDirectoryHome({
  workspaceDraft,
  setWorkspaceDraft,
  submitWorkspace,
  directoryCards,
  openWorkspaceModal,
}: {
  workspaceDraft: string;
  setWorkspaceDraft: (value: string) => void;
  submitWorkspace: () => void;
  directoryCards: WorkspaceDirectoryCard[];
  openWorkspaceModal: (workspaceId: string, kind: WorkspaceModalState["kind"]) => void;
}) {
  return (
    <>
      <section className="band workspace-directory-header">
        <div className="section-title">
          <div>
            <p className="eyebrow">工作区</p>
            <h2>我的工作区</h2>
          </div>
          <Building2 size={20} />
        </div>
        <div className="workspace-directory-create">
          <label>
            新协作工作区
            <input
              value={workspaceDraft}
              onChange={(event) => setWorkspaceDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") submitWorkspace();
              }}
              placeholder="例如：交付团队"
            />
          </label>
          <button className="primary-button" disabled={!workspaceDraft.trim()} onClick={submitWorkspace} type="button">
            <Plus size={16} />
            新增工作区
          </button>
        </div>
      </section>

      <section className="workspace-directory-grid" aria-label="工作区列表">
        {directoryCards.map((card) => (
          <article className="workspace-directory-card" key={card.workspace.id}>
            <div className="workspace-directory-card-head">
              <div>
                <span className="workspace-source-badge">{workspaceTypeLabel(card.workspace)}</span>
                <h2>{card.workspace.name}</h2>
              </div>
              <div className="project-overview-progress-inline">
                <strong>{card.progressPercent}%</strong>
                <span>进度</span>
              </div>
            </div>
            <div className="project-overview-meter">
              <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
            </div>
            <div className="workspace-directory-actions">
              <button className="workspace-directory-action" onClick={() => openWorkspaceModal(card.workspace.id, "projects")} type="button">
                <span>项目</span>
                <strong>{card.projects.length}</strong>
                <small>查看与新增</small>
              </button>
              <button className="workspace-directory-action" onClick={() => openWorkspaceModal(card.workspace.id, "members")} type="button">
                <span>成员</span>
                <strong>{card.memberCount}</strong>
                <small>{(card.workspace.type ?? "shared") === "private" ? "私人" : "邀请与维护"}</small>
              </button>
            </div>
          </article>
        ))}
        {directoryCards.length === 0 && <p className="empty">当前账号还没有可访问的工作区。</p>}
      </section>
    </>
  );
}
