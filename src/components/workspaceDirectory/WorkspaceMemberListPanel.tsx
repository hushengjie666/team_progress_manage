import { Plus, UserMinus, Users } from "lucide-react";
import type { Account, WorkspaceMembership, WorkspaceType } from "../../types";
import type { WorkspaceDirectoryCard } from "./workspaceDirectoryModel";

type WorkspaceMemberListPanelProps = {
  selectedCard: WorkspaceDirectoryCard;
  currentAccount?: Account;
  selectedMembers: WorkspaceMembership[];
  selectedWorkspaceType: WorkspaceType;
  editingOwnerAccountId: string;
  selectedMemberDraft: { email: string };
  canEditSelectedWorkspace: boolean;
  canChangeSelectedWorkspaceOwner: boolean;
  selectWorkspaceOwner: (accountId: string, checked: boolean) => Promise<void>;
  updateWorkspaceMemberDraft: (workspaceId: string, patch: Partial<{ email: string }>) => void;
  inviteWorkspaceMember: (workspaceId: string, email: string) => void;
  unbindWorkspaceMember: (member: WorkspaceMembership) => Promise<void>;
};

export function WorkspaceMemberListPanel({
  selectedCard,
  currentAccount,
  selectedMembers,
  selectedWorkspaceType,
  editingOwnerAccountId,
  selectedMemberDraft,
  canEditSelectedWorkspace,
  canChangeSelectedWorkspaceOwner,
  selectWorkspaceOwner,
  updateWorkspaceMemberDraft,
  inviteWorkspaceMember,
  unbindWorkspaceMember,
}: WorkspaceMemberListPanelProps) {
  return (
    <section className="workspace-member-panel">
      <div className="member-section-title">
        <strong>成员列表</strong>
        <span>{selectedMembers.length} 人</span>
      </div>
      {selectedWorkspaceType === "private" ? (
        <p className="muted compact-copy">私人工作区只允许本人使用，不支持添加成员。</p>
      ) : (
        <div className="workspace-member-invite">
          <label>
            成员登录账号
            <input
              value={selectedMemberDraft.email}
              onChange={(event) => updateWorkspaceMemberDraft(selectedCard.workspace.id, { email: event.target.value })}
              placeholder="输入对方登录邮箱或手机号"
            />
          </label>
          <button
            className="primary-button"
            disabled={!selectedMemberDraft.email.trim()}
            onClick={() => {
              inviteWorkspaceMember(selectedCard.workspace.id, selectedMemberDraft.email);
              updateWorkspaceMemberDraft(selectedCard.workspace.id, { email: "" });
            }}
            type="button"
          >
            <Plus size={16} />
            发送邀请
          </button>
        </div>
      )}
      <div className="workspace-member-list">
        {selectedMembers.map((member) => {
          const isOwner = member.accountId === editingOwnerAccountId || member.role === "owner";
          const isCurrentAccount = member.accountId === currentAccount?.id;
          const unbindDisabledReason =
            !canEditSelectedWorkspace
              ? "当前账号没有成员管理权限"
              : selectedWorkspaceType === "private"
                ? "私人工作区不支持成员解除绑定"
                : isOwner
                  ? "负责人不能解除绑定，请先更换负责人"
                  : isCurrentAccount
                    ? "不能解除当前登录账号"
                    : "";
          return (
            <div className="workspace-member-row" key={member.id}>
              <Users size={16} />
              <div>
                <strong>{member.name}</strong>
                <span>{member.email}</span>
              </div>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={isOwner}
                  disabled={
                    !canChangeSelectedWorkspaceOwner ||
                    selectedWorkspaceType === "private" ||
                    isOwner
                  }
                  onChange={(event) => void selectWorkspaceOwner(member.accountId, event.target.checked)}
                />
                负责人
              </label>
              <label className="inline-toggle">
                <input type="checkbox" checked disabled readOnly />
                执行者
              </label>
              <span className="workspace-member-status-pill">
                {member.status === "active" ? "正常" : "停用"}
              </span>
              <button
                className="small-button workspace-member-unbind"
                disabled={Boolean(unbindDisabledReason)}
                onClick={() => void unbindWorkspaceMember(member)}
                title={unbindDisabledReason || "解除该成员的工作区访问权限"}
                type="button"
              >
                <UserMinus size={14} />
                解除绑定
              </button>
            </div>
          );
        })}
        {!selectedMembers.length && <p className="empty">当前账号没有该工作区的成员管理权限，或暂无成员。</p>}
      </div>
    </section>
  );
}
