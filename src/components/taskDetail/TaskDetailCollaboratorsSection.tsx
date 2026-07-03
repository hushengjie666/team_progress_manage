import type { ProjectMember, Task } from "../../types";

type TaskDetailCollaboratorsSectionProps = {
  task: Task;
  projectMembers: ProjectMember[];
  canEdit: boolean;
  updateTaskAssignment: (taskId: string, assignment: { collaboratorMemberIds?: string[] }) => void;
};

export function TaskDetailCollaboratorsSection({
  task,
  projectMembers,
  canEdit,
  updateTaskAssignment,
}: TaskDetailCollaboratorsSectionProps) {
  const collaboratorIds = task.collaboratorMemberIds ?? [];
  const toggleCollaborator = (memberId: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...collaboratorIds, memberId]))
      : collaboratorIds.filter((id) => id !== memberId);
    updateTaskAssignment(task.id, { collaboratorMemberIds: nextIds });
  };

  return (
    <div className="subtask-box">
      <div className="section-title compact-title">
        <div>
          <p className="eyebrow">协作成员</p>
          <h2>协作者</h2>
        </div>
      </div>
      <div className="toggle-row">
        {projectMembers.map((member) => (
          <label key={member.id}>
            <input
              type="checkbox"
              checked={collaboratorIds.includes(member.id)}
              disabled={!canEdit || member.id === task.primaryExecutorMemberId}
              onChange={(event) => toggleCollaborator(member.id, event.target.checked)}
            />
            {member.name}
          </label>
        ))}
        {!projectMembers.length && <p className="empty">这个项目还没有成员。</p>}
      </div>
    </div>
  );
}
