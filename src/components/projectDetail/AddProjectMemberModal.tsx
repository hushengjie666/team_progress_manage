import { useState } from "react";
import { Send, X } from "lucide-react";
import type { Project, ProjectMemberRole } from "../../types";

export function AddProjectMemberModal(props: {
  project: Project;
  canManage: boolean;
  inviteMember: (input: { email: string; roles: ProjectMemberRole[] }) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState("");
  const [roles, setRoles] = useState<ProjectMemberRole[]>(["executor"]);
  const normalizedEmail = email.trim().toLowerCase();
  const canInvite = Boolean(props.canManage && normalizedEmail);
  const updateRole = (role: ProjectMemberRole, checked: boolean) => {
    setRoles((value) => {
      const next = checked ? Array.from(new Set([...value, role])) : value.filter((item) => item !== role);
      return next.length ? next : ["executor"];
    });
  };
  const inviteProjectMember = () => {
    if (!canInvite) return;
    props.inviteMember({ email: normalizedEmail, roles });
    setEmail("");
    setRoles(["executor"]);
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        className="modal-panel add-project-member-modal no-search"
        role="dialog"
        aria-modal="true"
        aria-label="邀请项目成员"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PROJECT MEMBER</p>
            <h2>邀请成员</h2>
            <span>输入对方登录账号，对方同意后只获得「{props.project.name}」项目权限。</span>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        <div className="project-member-direct-create">
          <div>
            <strong>发送项目邀请</strong>
            <span>项目成员不会加入工作区成员列表，也不会看到该工作区的其他项目。</span>
          </div>
          <div className="project-member-invite-form">
            <label>
              成员登录账号
              <input
                autoFocus
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="输入登录邮箱或手机号"
              />
            </label>
          </div>
          <div className="project-member-direct-actions">
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={roles.includes("project_owner")}
                disabled={!props.canManage}
                onChange={(event) => updateRole("project_owner", event.target.checked)}
              />
              项目负责人
            </label>
            <label className="inline-toggle">
              <input
                type="checkbox"
                checked={roles.includes("executor")}
                disabled={!props.canManage}
                onChange={(event) => updateRole("executor", event.target.checked)}
              />
              执行者
            </label>
            <button className="primary-button" disabled={!canInvite} onClick={inviteProjectMember}>
              <Send size={15} />
              发送邀请
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
