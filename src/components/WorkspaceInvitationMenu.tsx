import { BellRing, Check, RefreshCw } from "lucide-react";
import { useState } from "react";
import type { ProjectInvitation, WorkspaceInvitation } from "../types";

export function WorkspaceInvitationMenu({
  workspaceInvitations,
  projectInvitations,
  acceptWorkspaceInvitation,
  acceptProjectInvitation,
  refreshInvitations,
}: {
  workspaceInvitations: WorkspaceInvitation[];
  projectInvitations: ProjectInvitation[];
  acceptWorkspaceInvitation: (invitationId: string) => void;
  acceptProjectInvitation: (invitationId: string) => void;
  refreshInvitations: () => void;
}) {
  const [open, setOpen] = useState(false);
  const pendingWorkspaceInvitations = workspaceInvitations.filter((invitation) => invitation.status === "pending");
  const pendingProjectInvitations = projectInvitations.filter((invitation) => invitation.status === "pending");
  const pendingCount = pendingWorkspaceInvitations.length + pendingProjectInvitations.length;

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
            <button className="icon-button small" onClick={refreshInvitations} title="刷新邀请" type="button">
              <RefreshCw size={15} />
            </button>
          </div>
          <div className="invitation-list">
            {pendingCount === 0 && <p className="empty">暂无待处理邀请。</p>}
            {pendingWorkspaceInvitations.map((invitation) => (
              <article className="invitation-item" key={invitation.id}>
                <div>
                  <span className="workspace-source-badge">
                    {(invitation.workspaceType ?? "shared") === "private" ? "私人" : "协作"} · {invitation.workspaceName}
                  </span>
                  <strong>{invitation.workspaceName}</strong>
                  <small>{invitation.inviterName || invitation.inviterEmail} 邀请你加入</small>
                </div>
                <button className="primary-button" onClick={() => acceptWorkspaceInvitation(invitation.id)} type="button">
                  <Check size={15} />
                  同意加入
                </button>
              </article>
            ))}
            {pendingProjectInvitations.map((invitation) => (
              <article className="invitation-item" key={invitation.id}>
                <div>
                  <span className="workspace-source-badge">项目 · {invitation.workspaceName}</span>
                  <strong>{invitation.projectName}</strong>
                  <small>
                    {invitation.inviterName || invitation.inviterEmail} 邀请你加入当前项目
                    {invitation.roles.includes("project_owner") ? "，担任项目负责人" : "，担任执行者"}
                  </small>
                </div>
                <button className="primary-button" onClick={() => acceptProjectInvitation(invitation.id)} type="button">
                  <Check size={15} />
                  同意加入
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
