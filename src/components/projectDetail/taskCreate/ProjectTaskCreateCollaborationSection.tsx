import type { ProjectMember } from "../../../types";
import type { ProjectTaskCreateSectionProps } from "./taskCreateTypes";

type ProjectTaskCreateCollaborationSectionProps = ProjectTaskCreateSectionProps & {
  members: ProjectMember[];
};

export function ProjectTaskCreateCollaborationSection({
  draft,
  members,
  canEdit,
  setDraft,
}: ProjectTaskCreateCollaborationSectionProps) {
  return (
    <article className="project-task-create-section wide">
      <p className="eyebrow">协作与子任务</p>
      <div className="project-task-create-collaboration">
        <div className="toggle-row">
          {members.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                checked={(draft.collaboratorMemberIds ?? []).includes(member.id)}
                disabled={!canEdit || member.id === draft.primaryExecutorMemberId}
                onChange={(event) => {
                  const current = draft.collaboratorMemberIds ?? [];
                  setDraft({
                    ...draft,
                    collaboratorMemberIds: event.target.checked
                      ? Array.from(new Set([...current, member.id]))
                      : current.filter((id) => id !== member.id),
                  });
                }}
              />
              {member.name}
            </label>
          ))}
          {!members.length && <p className="empty">这个项目还没有成员。</p>}
        </div>
        <label>
          初始子任务
          <textarea
            value={(draft.subtasks ?? []).join("\n")}
            disabled={!canEdit}
            onChange={(event) =>
              setDraft({
                ...draft,
                subtasks: event.target.value
                  .split("\n")
                  .map((item) => item.trim())
                  .filter(Boolean),
              })
            }
            placeholder="每行一个子任务"
          />
        </label>
      </div>
    </article>
  );
}
