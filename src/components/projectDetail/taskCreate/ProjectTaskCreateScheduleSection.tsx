import { formatDateTimeLocal, parseDateTimeLocal } from "../../../appModel";
import type { RepeatRule } from "../../../types";
import type { ProjectTaskCreateSectionProps } from "./taskCreateTypes";

export function ProjectTaskCreateScheduleSection({
  draft,
  canEdit,
  setDraft,
}: ProjectTaskCreateSectionProps) {
  const repeatRule = draft.repeatRule ?? "none";
  const canEditInterval = repeatRule === "interval" || repeatRule === "after_completion";

  return (
    <article className="project-task-create-section">
      <p className="eyebrow">排期与重复</p>
      <div className="project-task-create-dialog-form advanced">
        <label>
          预计开始
          <input
            type="datetime-local"
            value={formatDateTimeLocal(draft.expectedStartAt)}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, expectedStartAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          预计完成
          <input
            type="datetime-local"
            value={formatDateTimeLocal(draft.expectedFinishAt)}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, expectedFinishAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          到期日
          <input
            type="datetime-local"
            value={formatDateTimeLocal(draft.dueAt)}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, dueAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          提醒
          <input
            type="datetime-local"
            value={formatDateTimeLocal(draft.reminderAt)}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, reminderAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          重复
          <select
            value={repeatRule}
            disabled={!canEdit}
            onChange={(event) => setDraft({ ...draft, repeatRule: event.target.value as RepeatRule })}
          >
            <option value="none">不重复</option>
            <option value="daily">每天</option>
            <option value="weekly">每周</option>
            <option value="weekdays">工作日</option>
            <option value="monthly">每月</option>
            <option value="interval">间隔天数</option>
            <option value="after_completion">完成后间隔</option>
          </select>
        </label>
        <label>
          间隔天
          <input
            type="number"
            min="1"
            max="60"
            value={draft.repeatIntervalDays ?? 1}
            disabled={!canEdit || !canEditInterval}
            onChange={(event) => setDraft({ ...draft, repeatIntervalDays: Number(event.target.value) })}
          />
        </label>
      </div>
    </article>
  );
}
