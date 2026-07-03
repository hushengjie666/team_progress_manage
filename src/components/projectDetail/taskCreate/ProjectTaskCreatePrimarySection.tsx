import { taskStageOptionsForMode } from "../../../appModel";
import type { ProjectMember, TaskStageMode } from "../../../types";
import type { ProjectTaskCreateSectionProps } from "./taskCreateTypes";

type ProjectTaskCreatePrimarySectionProps = ProjectTaskCreateSectionProps & {
  executors: ProjectMember[];
  taskStageMode: TaskStageMode;
};

export function ProjectTaskCreatePrimarySection({
  draft,
  executors,
  taskStageMode,
  canEdit,
  setDraft,
}: ProjectTaskCreatePrimarySectionProps) {
  const stageOptions = taskStageOptionsForMode(taskStageMode);

  return (
    <section className="project-task-create-primary">
      <label className="task-create-title-field">
        标题
        <input
          value={draft.title}
          disabled={!canEdit}
          onChange={(event) => setDraft({ ...draft, title: event.target.value })}
          placeholder="这个项目下一步要推进什么"
          autoFocus
        />
      </label>
      <div className="task-create-stage-field">
        <span>阶段</span>
        <div className="stage-switch-group" role="radiogroup" aria-label="任务阶段">
          {stageOptions.map((option) => {
            const selected = (draft.stage ?? "requirements") === option.value;
            return (
              <button
                aria-checked={selected}
                className={selected ? "stage-switch selected" : "stage-switch"}
                disabled={!canEdit}
                key={option.value}
                onClick={() => setDraft({ ...draft, stage: option.value })}
                role="radio"
                type="button"
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
      <div className="project-task-create-primary-grid">
        <label>
          主执行人
          <select
            value={draft.primaryExecutorMemberId ?? ""}
            disabled={!canEdit}
            onChange={(event) => {
              const primaryExecutorMemberId = event.target.value || undefined;
              setDraft({
                ...draft,
                primaryExecutorMemberId,
                collaboratorMemberIds: (draft.collaboratorMemberIds ?? []).filter((id) => id !== primaryExecutorMemberId),
              });
            }}
          >
            <option value="">未分配</option>
            {executors.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          估算时长（小时）
          <input
            type="number"
            min="0.25"
            max="240"
            step="0.25"
            value={draft.estimateHours ?? 1}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, estimateHours: Number(event.target.value) })}
          />
        </label>
      </div>
      <label>
        备注
        <textarea
          value={draft.notes}
          disabled={!canEdit}
          onChange={(event) => setDraft({ ...draft, notes: event.target.value })}
          placeholder="补充任务背景、验收口径或注意事项"
        />
      </label>
    </section>
  );
}
