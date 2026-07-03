import { UserPlus } from "lucide-react";
import type { ProjectDetailModel } from "../../projectDetail";
import type { Project, ProjectMember, ProjectMemberRole } from "../../types";
import { AddProjectMemberModal } from "./AddProjectMemberModal";
import { ProjectMemberBindingPanel } from "./ProjectMemberBindingPanel";

type ProjectDetailMembersTabProps = {
  project: Project;
  isPrivateProject: boolean;
  canManageProjectMembers: boolean;
  memberOverviewStats: ProjectDetailModel["memberOverviewStats"];
  accessibleProjectMembers: ProjectDetailModel["accessibleProjectMembers"];
  showAddMemberDialog: boolean;
  openAddMemberDialog: () => void;
  closeAddMemberDialog: () => void;
  inviteProjectMember: (input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) => void;
  updateMemberRole: (member: ProjectDetailModel["accessibleProjectMembers"][number], role: ProjectMemberRole, checked: boolean) => void;
  updateProjectMember: (member: ProjectMember) => void;
};

export function ProjectDetailMembersTab({
  project,
  isPrivateProject,
  canManageProjectMembers,
  memberOverviewStats,
  accessibleProjectMembers,
  showAddMemberDialog,
  openAddMemberDialog,
  closeAddMemberDialog,
  inviteProjectMember,
  updateMemberRole,
  updateProjectMember,
}: ProjectDetailMembersTabProps) {
  const canManageMembers = canManageProjectMembers && !isPrivateProject;
  return (
    <section className="band project-members-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">项目成员</p>
          <h2>项目成员管理</h2>
        </div>
        <button className="secondary-button" disabled={!canManageMembers} onClick={openAddMemberDialog}>
          <UserPlus size={16} />
          添加成员
        </button>
      </div>
      {isPrivateProject && (
        <p className="muted compact-copy">私人项目不允许邀请其他人员；这里仅展示当前项目成员。</p>
      )}
      <div className="project-member-summary-grid">
        {memberOverviewStats.map((item) => (
          <article className={item.label === "待验收" && item.value > 0 ? "project-member-summary-card attention" : "project-member-summary-card"} key={item.label}>
            <span>{item.label}</span>
            <strong>{item.value}</strong>
            <small>{item.helper}</small>
          </article>
        ))}
      </div>
      <ProjectMemberBindingPanel
        accessibleMembers={accessibleProjectMembers}
        canManage={canManageMembers}
        isPrivateProject={isPrivateProject}
        updateMemberRole={updateMemberRole}
        updateProjectMember={updateProjectMember}
      />
      {showAddMemberDialog && canManageMembers && (
        <AddProjectMemberModal
          project={project}
          canManage={canManageMembers}
          inviteMember={(input) => inviteProjectMember({
            workspaceId: project.workspaceId,
            projectId: project.id,
            email: input.email,
            roles: input.roles,
          })}
          onClose={closeAddMemberDialog}
        />
      )}
    </section>
  );
}
