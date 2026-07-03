import { BellRing, Check, RefreshCw, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ProjectInvitation, WorkspaceInvitation } from "../types";

export function WorkspaceInvitationMenu({
  workspaceInvitations,
  projectInvitations,
  acceptWorkspaceInvitation,
  acceptProjectInvitation,
  deleteWorkspaceInvitation,
  deleteProjectInvitation,
  refreshInvitations,
}: {
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
  acceptWorkspaceInvitation: (invitationId: string) => void;
  acceptProjectInvitation: (invitationId: string) => void;
  deleteWorkspaceInvitation: (invitationId: string) => void;
  deleteProjectInvitation: (invitationId: string) => void;
  refreshInvitations: () => void | Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const refreshInvitationsRef = useRef(refreshInvitations);
  const pendingWorkspaceInvitations = workspaceInvitations.filter(
    (invitation) => invitation.status === "pending",
  );
  const pendingProjectInvitations = projectInvitations.filter(
    (invitation) => invitation.status === "pending",
  );
  const pendingCount = pendingWorkspaceInvitations.length + pendingProjectInvitations.length;
  const runRefresh = () => {
    setRefreshing(true);
    void Promise.resolve(refreshInvitationsRef.current())
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };
  const confirmDelete = (label: string, deleteInvitation: () => void) => {
    if (window.confirm(`确认删除「${label}」这条邀请吗？删除后将从待处理列表移除。`)) {
      deleteInvitation();
    }
  };

  useEffect(() => {
    refreshInvitationsRef.current = refreshInvitations;
  }, [refreshInvitations]);

  useEffect(() => {
    if (open) runRefresh();
  }, [open]);

  return (
    <div className="invitation-menu">
      <button className={pendingCount > 0 ? "secondary-button invitation-trigger active" : "secondary-button invitation-trigger"} onClick={() => setOpen((value) => !value)} type="button">
        <BellRing size={16} />
        <span>待处理</span>
        {pendingCount > 0 && <strong>{pendingCount}</strong>}
      </button>
      {open && (
        <div className="invitation-popover" role="dialog" aria-label="待处理">
          <div className="invitation-popover-header">
            <div>
              <p className="eyebrow">待处理邀请</p>
              <h3>邀请处理</h3>
            </div>
            <button className="icon-button small" onClick={runRefresh} title="刷新邀请" type="button">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="invitation-list">
            {refreshing && <p className="empty">正在刷新邀请...</p>}
            {!refreshing && pendingCount === 0 && <p className="empty">暂无待处理邀请。</p>}
            {!refreshing && pendingWorkspaceInvitations.map((invitation) => (
              <article className="invitation-item" key={invitation.id}>
                <div className="invitation-copy">
                  <span className="workspace-source-badge">
                    {(invitation.workspaceType ?? "shared") === "private" ? "私人" : "协作"} · {invitation.workspaceName}
                  </span>
                  <strong>{invitation.workspaceName}</strong>
                  <small>{invitation.inviterName || invitation.inviterEmail} 邀请你加入</small>
                </div>
                <div className="invitation-actions">
                  <button className="primary-button" onClick={() => acceptWorkspaceInvitation(invitation.id)} type="button">
                    <Check size={15} />
                    同意加入
                  </button>
                  <button
                    className="icon-button small danger"
                    onClick={() => confirmDelete(invitation.workspaceName, () => deleteWorkspaceInvitation(invitation.id))}
                    title="删除邀请"
                    aria-label={`删除 ${invitation.workspaceName} 邀请`}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
            {!refreshing && pendingProjectInvitations.map((invitation) => (
              <article className="invitation-item" key={invitation.id}>
                <div className="invitation-copy">
                  <span className="workspace-source-badge">项目 · {invitation.workspaceName}</span>
                  <strong>{invitation.projectName}</strong>
                  <small>
                    {invitation.inviterName || invitation.inviterEmail} 邀请你加入当前项目
                    {invitation.roles.includes("project_owner") ? "，担任项目负责人" : "，担任执行者"}
                  </small>
                </div>
                <div className="invitation-actions">
                  <button className="primary-button" onClick={() => acceptProjectInvitation(invitation.id)} type="button">
                    <Check size={15} />
                    同意加入
                  </button>
                  <button
                    className="icon-button small danger"
                    onClick={() => confirmDelete(invitation.projectName, () => deleteProjectInvitation(invitation.id))}
                    title="删除邀请"
                    aria-label={`删除 ${invitation.projectName} 邀请`}
                    type="button"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
