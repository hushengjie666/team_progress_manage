import { formatDateTimeLocal, parseDateTimeLocal } from "../../appModel";
import type { RepeatRule, Task } from "../../types";

type TaskDetailScheduleSectionProps = {
  task: Task;
  canEdit: boolean;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
};

export function TaskDetailScheduleSection({ task, canEdit, updateTask }: TaskDetailScheduleSectionProps) {
  return (
    <div className="detail-section">
      <div className="detail-section-heading">
        <strong>排期与重复</strong>
        <span>期望什么时候开始、什么时候交付。</span>
      </div>
      <div className="detail-grid">
        <label>
          预计开始
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.expectedStartAt)}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { expectedStartAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          预计完成
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.expectedFinishAt)}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { expectedFinishAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          到期日
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.dueAt)}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { dueAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          提醒
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.reminderAt)}
            disabled={!canEdit}
            onChange={(event) => updateTask(task.id, { reminderAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          重复
          <select value={task.repeatRule ?? "none"} disabled={!canEdit} onChange={(event) => updateTask(task.id, { repeatRule: event.target.value as RepeatRule })}>
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
            value={task.repeatIntervalDays ?? 1}
            onChange={(event) => updateTask(task.id, { repeatIntervalDays: Number(event.target.value) })}
            disabled={!canEdit || ((task.repeatRule ?? "none") !== "interval" && (task.repeatRule ?? "none") !== "after_completion")}
          />
        </label>
      </div>
    </div>
  );
}
