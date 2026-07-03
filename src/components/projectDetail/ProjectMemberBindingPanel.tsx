import type { ProjectAccessibleMember } from "../../projectDetail";
import type { ProjectMember, ProjectMemberRole } from "../../types";

export function ProjectMemberBindingPanel({
  accessibleMembers,
  canManage,
  isPrivateProject = false,
  updateMemberRole,
  updateProjectMember,
}: {
  accessibleMembers: ProjectAccessibleMember[];
  canManage: boolean;
  isPrivateProject?: boolean;
  updateMemberRole: (member: ProjectAccessibleMember, role: ProjectMemberRole, checked: boolean) => void;
  updateProjectMember: (member: ProjectMember) => void;
}) {
  return (
    <section className="project-binding-panel inline-project-binding">
      <div className="member-section-title">
        <strong>项目成员管理</strong>
        <span>
          {isPrivateProject
            ? "私人项目不允许邀请其他人员。"
            : "这里显示所有有当前项目权限的成员；工作区成员默认可访问当前工作区项目，项目级成员只访问当前项目。"}
        </span>
      </div>
      <div className="project-binding-list">
        {accessibleMembers.map((member) => {
          const binding = member.projectMember;
          const rowKey = `${member.source}:${member.identityKey}:${member.id}`;
          const roles = binding?.roles ?? member.roles;
          return (
            <article
              className={binding ? "project-binding-row bound" : "project-binding-row inherited"}
              data-member-identity={member.identityKey}
              key={rowKey}
            >
              <div>
                <strong>{member.name}</strong>
                <span>{member.email ?? "未填写登录信息"}</span>
              </div>
              <span className={`member-source-pill ${member.source}`}>{member.sourceLabel}</span>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={roles.includes("project_owner")}
                  disabled={!canManage}
                  onChange={(event) => updateMemberRole(member, "project_owner", event.target.checked)}
                />
                项目负责人
              </label>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={roles.includes("executor")}
                  disabled={!canManage}
                  onChange={(event) => updateMemberRole(member, "executor", event.target.checked)}
                />
                执行者
              </label>
              {binding ? (
                <button className="secondary-button" disabled={!canManage} onClick={() => updateProjectMember({ ...binding, status: "disabled" })}>
                  解除绑定
                </button>
              ) : (
                <span className="project-binding-muted">工作区授权</span>
              )}
            </article>
          );
        })}
        {!accessibleMembers.length && (
          <p className="empty">
            {isPrivateProject ? "私人项目暂无可展示成员。" : "当前项目还没有可访问成员，请点击“添加成员”邀请项目成员。"}
          </p>
        )}
      </div>
    </section>
  );
}
