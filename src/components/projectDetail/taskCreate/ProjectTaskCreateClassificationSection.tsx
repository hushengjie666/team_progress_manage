import { labelPriority, labelSeverity } from "../../../appModel";
import type { Priority, Severity } from "../../../types";
import type { ProjectTaskCreateSectionProps } from "./taskCreateTypes";

type ProjectTaskCreateClassificationSectionProps = ProjectTaskCreateSectionProps & {
  tagText: string;
  setTagText: (value: string) => void;
};

export function ProjectTaskCreateClassificationSection({
  draft,
  tagText,
  canEdit,
  setDraft,
  setTagText,
}: ProjectTaskCreateClassificationSectionProps) {
  return (
    <article className="project-task-create-section">
      <p className="eyebrow">基本分类</p>
      <div className="project-task-create-dialog-form advanced project-task-create-classification">
        <label className="task-create-tag-field">
          标签
          <input
            value={tagText}
            disabled={!canEdit}
            onChange={(event) => {
              const value = event.target.value;
              setTagText(value);
              setDraft({
                ...draft,
                tags: value
                  .split(/[,\s，]+/)
                  .map((item) => item.trim())
                  .filter(Boolean),
              });
            }}
            placeholder="例如：需求, 前端"
          />
        </label>
        <label>
          优先级
          <select
            value={draft.priority ?? "medium"}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}
          >
            {(["urgent", "high", "medium", "low"] as const).map((priority) => (
              <option key={priority} value={priority}>{labelPriority[priority]}</option>
            ))}
          </select>
        </label>
        <label>
          严重度
          <select
            value={draft.severity ?? "medium"}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, severity: event.target.value as Severity })}
          >
            {(["very_high", "high", "medium", "low"] as const).map((severity) => (
              <option key={severity} value={severity}>{labelSeverity[severity]}</option>
            ))}
          </select>
        </label>
      </div>
    </article>
  );
}
