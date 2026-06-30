import { Sparkles, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { AppState, TeamMember } from "../../types";

export function SettingsMembersSection({
  state,
  createTeamMember,
  updateTeamMember,
  updateTeamMemberPassword,
  deleteTeamMember,
}: {
  state: AppState;
  createTeamMember: (name: string, email: string, password?: string) => void;
  updateTeamMember: (member: TeamMember) => void;
  updateTeamMemberPassword: (member: TeamMember, password: string) => void;
  deleteTeamMember: (teamMemberId: string) => void;
}) {
  const [memberDraft, setMemberDraft] = useState({ name: "", email: "", password: "demo" });
  const [memberDraftWarning, setMemberDraftWarning] = useState("");
  const [memberPasswordDrafts, setMemberPasswordDrafts] = useState<Record<string, string>>({});
  const canManageWorkspaceProjects = true;
  const normalizedMemberDraftEmail = memberDraft.email.trim().toLowerCase();
  const memberDraftEmailExists = Boolean(
    normalizedMemberDraftEmail &&
      state.teamMembers.some(
        (member) => member.status !== "disabled" && member.email?.trim().toLowerCase() === normalizedMemberDraftEmail,
      ),
  );
  const memberDraftValidationMessage = memberDraftEmailExists
    ? "该登录邮箱或手机号已存在于成员库，请直接编辑现有成员或绑定到项目。"
    : "";

  return (
    <section className="band settings-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">成员管理</p>
          <h2>团队成员库</h2>
        </div>
        <Sparkles size={20} />
      </div>
      <p className="muted section-helper">成员先在这里统一创建和维护，项目页面只负责把成员绑定进项目并设置项目内角色。</p>
      <section className="member-create-panel workspace-member-create">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">新增成员</p>
            <h2>创建成员账号</h2>
          </div>
        </div>
        <div className="settings-grid">
          <label>
            成员姓名
            <input
              value={memberDraft.name}
              disabled={!canManageWorkspaceProjects}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, name: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
          <label>
            登录邮箱或手机号
            <input
              value={memberDraft.email}
              disabled={!canManageWorkspaceProjects}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, email: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
          <label>
            初始密码
            <input
              type="password"
              value={memberDraft.password}
              disabled={!canManageWorkspaceProjects}
              onChange={(event) => {
                setMemberDraft({ ...memberDraft, password: event.target.value });
                setMemberDraftWarning("");
              }}
            />
          </label>
        </div>
        <div className="button-row">
          <button
            className="primary-button"
            disabled={!canManageWorkspaceProjects || memberDraftEmailExists}
            onClick={() => {
              if (!memberDraft.name.trim() || !memberDraft.email.trim() || !memberDraft.password.trim()) {
                setMemberDraftWarning("请先填写成员姓名、登录邮箱或手机号和初始密码。");
                return;
              }
              if (memberDraftValidationMessage) {
                setMemberDraftWarning(memberDraftValidationMessage);
                return;
              }
              createTeamMember(memberDraft.name, memberDraft.email, memberDraft.password);
              setMemberDraft({ name: "", email: "", password: "demo" });
              setMemberDraftWarning("");
            }}
          >
            创建成员账号
          </button>
        </div>
        {(memberDraftWarning || memberDraftValidationMessage) && (
          <p className="warning-line compact">{memberDraftWarning || memberDraftValidationMessage}</p>
        )}
      </section>
      <div className="member-directory">
        {state.teamMembers.map((member) => (
          <TeamMemberCard
            key={member.id}
            member={member}
            teamMembers={state.teamMembers}
            projectCount={state.projectMembers.filter((binding) => binding.teamMemberId === member.id && binding.status !== "disabled").length}
            canManage={canManageWorkspaceProjects}
            passwordDraft={memberPasswordDrafts[member.id] ?? ""}
            updateMember={updateTeamMember}
            deleteMember={() => deleteTeamMember(member.id)}
            updatePasswordDraft={(password) => setMemberPasswordDrafts({ ...memberPasswordDrafts, [member.id]: password })}
            updatePassword={(password) => {
              updateTeamMemberPassword(member, password);
              setMemberPasswordDrafts({ ...memberPasswordDrafts, [member.id]: "" });
            }}
          />
        ))}
        {!state.teamMembers.length && <p className="empty">还没有团队成员，请先创建成员账号。</p>}
      </div>
    </section>
  );
}

function TeamMemberCard({
  member,
  teamMembers,
  projectCount,
  canManage,
  updateMember,
  deleteMember,
  passwordDraft,
  updatePasswordDraft,
  updatePassword,
}: {
  member: TeamMember;
  teamMembers: TeamMember[];
  projectCount: number;
  canManage: boolean;
  updateMember: (member: TeamMember) => void;
  deleteMember: () => void;
  passwordDraft: string;
  updatePasswordDraft: (password: string) => void;
  updatePassword: (password: string) => void;
}) {
  const [draft, setDraft] = useState({ name: member.name, email: member.email ?? "" });
  const normalizedEmail = draft.email.trim().toLowerCase();
  const nameValue = draft.name.trim();
  const originalEmail = member.email ?? "";
  const hasChanges = draft.name !== member.name || draft.email !== originalEmail;
  const emailRequired = true;
  const emailMissing = emailRequired && !normalizedEmail;
  const emailDuplicate = Boolean(normalizedEmail) && teamMembers.some(
    (item) => item.id !== member.id && item.status !== "disabled" && item.email?.trim().toLowerCase() === normalizedEmail,
  );
  const validationMessage = !nameValue
    ? "请输入成员姓名"
    : emailMissing
      ? "已绑定账号的成员必须保留登录邮箱或手机号"
      : emailDuplicate
        ? "该登录邮箱或手机号已存在于成员库"
        : "";
  const canSave = canManage && hasChanges && !validationMessage;

  useEffect(() => {
    setDraft({ name: member.name, email: member.email ?? "" });
  }, [member.id, member.name, member.email]);

  return (
    <article className="member-card team-member-card" key={member.id}>
      <div className="member-profile-editor">
        <div className="member-card-main">
          <label>
            姓名
            <input value={draft.name} disabled={!canManage} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
          </label>
          <label>
            登录邮箱或手机号
            <input value={draft.email} disabled={!canManage} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
          </label>
        </div>
        {validationMessage && hasChanges && <p className="member-validation">{validationMessage}</p>}
      </div>
      <div className="member-role-row">
        <span className="status-pill">{member.status === "disabled" ? "已停用" : "启用中"}</span>
        <span className="status-pill">{projectCount} 个项目</span>
        <span className="status-pill">{member.accountId ? "已绑定账号" : "本地成员"}</span>
        <button
          className="secondary-button"
          disabled={!canSave}
          onClick={() => updateMember({ ...member, name: nameValue, email: normalizedEmail || undefined })}
        >
          保存资料
        </button>
        {hasChanges && (
          <button className="small-button" disabled={!canManage} onClick={() => setDraft({ name: member.name, email: member.email ?? "" })}>
            重置
          </button>
        )}
        <button className="icon-button small danger" disabled={!canManage} title="删除成员" onClick={deleteMember}>
          <Trash2 size={15} />
        </button>
      </div>
      <div className="member-password-row">
        <label>
          新密码
          <input
            type="password"
            value={passwordDraft}
            disabled={!canManage || !member.accountId}
            placeholder={member.accountId ? "输入后点击修改" : "该成员未绑定账号"}
            onChange={(event) => updatePasswordDraft(event.target.value)}
          />
        </label>
        <button className="secondary-button" disabled={!canManage || !member.accountId || !passwordDraft.trim()} onClick={() => updatePassword(passwordDraft)}>
          修改密码
        </button>
      </div>
    </article>
  );
}
