import { useEffect, useState } from "react";
import { ChevronRight, X } from "lucide-react";
import {
  formatDateTimeLocal,
  labelPriority,
  labelSeverity,
  parseDateTimeLocal,
  taskStageOptionsForMode,
} from "../../appModel";
import type { ProjectMember, RepeatRule, Priority, Severity, TaskStageMode } from "../../types";
import type { ProjectTaskInput } from "../../projectDetail";

export function ProjectTaskCreateDialog(props: {
  open: boolean;
  draft: ProjectTaskInput;
  members: ProjectMember[];
  executors: ProjectMember[];
  taskStageMode: TaskStageMode;
  canEdit: boolean;
  setDraft: (draft: ProjectTaskInput) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [tagText, setTagText] = useState("");
  useEffect(() => {
    if (props.open) {
      setShowAdvanced(false);
      setTagText((props.draft.tags ?? []).join(", "));
    }
  }, [props.open]);

  if (!props.open) return null;

  const stageOptions = taskStageOptionsForMode(props.taskStageMode);

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-panel project-task-create-modal" role="dialog" aria-modal="true" aria-label="添加项目任务">
        <div className="section-title project-task-create-header">
          <div>
            <p className="eyebrow">Project Task</p>
            <h2>添加任务</h2>
          </div>
          <button className="icon-button small" onClick={props.onCancel} title="关闭">
            <X size={16} />
          </button>
        </div>
        <div className="project-task-create-body">
          <section className="project-task-create-primary">
            <label className="task-create-title-field">
              标题
              <input
                value={props.draft.title}
                disabled={!props.canEdit}
                onChange={(event) => props.setDraft({ ...props.draft, title: event.target.value })}
                placeholder="这个项目下一步要推进什么"
                autoFocus
              />
            </label>
            <div className="task-create-stage-field">
              <span>阶段</span>
              <div className="stage-switch-group" role="radiogroup" aria-label="任务阶段">
                {stageOptions.map((option) => {
                  const selected = (props.draft.stage ?? "requirements") === option.value;
                  return (
                    <button
                      aria-checked={selected}
                      className={selected ? "stage-switch selected" : "stage-switch"}
                      disabled={!props.canEdit}
                      key={option.value}
                      onClick={() => props.setDraft({ ...props.draft, stage: option.value })}
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
                  value={props.draft.primaryExecutorMemberId ?? ""}
                  disabled={!props.canEdit}
                  onChange={(event) => {
                    const primaryExecutorMemberId = event.target.value || undefined;
                    props.setDraft({
                      ...props.draft,
                      primaryExecutorMemberId,
                      collaboratorMemberIds: (props.draft.collaboratorMemberIds ?? []).filter((id) => id !== primaryExecutorMemberId),
                    });
                  }}
                >
                  <option value="">未分配</option>
                  {props.executors.map((member) => (
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
                  value={props.draft.estimateHours ?? 1}
                  disabled={!props.canEdit}
                  onChange={(event) => props.setDraft({ ...props.draft, estimateHours: Number(event.target.value) })}
                />
              </label>
            </div>
            <label>
              备注
              <textarea
                value={props.draft.notes}
                disabled={!props.canEdit}
                onChange={(event) => props.setDraft({ ...props.draft, notes: event.target.value })}
                placeholder="补充任务背景、验收口径或注意事项"
              />
            </label>
          </section>
          <button className="secondary-button project-task-advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>
            {showAdvanced ? "收起更多字段" : "展开更多字段"}
            <ChevronRight className={showAdvanced ? "rotate-90" : ""} size={16} />
          </button>
          {showAdvanced && (
            <div className="project-task-create-advanced">
              <article className="project-task-create-section">
                <p className="eyebrow">基本分类</p>
                <div className="project-task-create-dialog-form advanced project-task-create-classification">
                <label className="task-create-tag-field">
                  标签
                  <input
                    value={tagText}
                    disabled={!props.canEdit}
                    onChange={(event) => {
                      const value = event.target.value;
                      setTagText(value);
                      props.setDraft({
                        ...props.draft,
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
                    value={props.draft.priority ?? "medium"}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, priority: event.target.value as Priority })}
                  >
                    {(["urgent", "high", "medium", "low"] as const).map((priority) => (
                      <option key={priority} value={priority}>{labelPriority[priority]}</option>
                    ))}
                  </select>
                </label>
                <label>
                  严重度
                  <select
                    value={props.draft.severity ?? "medium"}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, severity: event.target.value as Severity })}
                  >
                    {(["very_high", "high", "medium", "low"] as const).map((severity) => (
                      <option key={severity} value={severity}>{labelSeverity[severity]}</option>
                    ))}
                  </select>
                </label>
                </div>
              </article>
              <article className="project-task-create-section">
                <p className="eyebrow">排期与重复</p>
                <div className="project-task-create-dialog-form advanced">
                <label>
                  预计开始
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(props.draft.expectedStartAt)}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, expectedStartAt: parseDateTimeLocal(event.target.value) })}
                  />
                </label>
                <label>
                  预计完成
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(props.draft.expectedFinishAt)}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, expectedFinishAt: parseDateTimeLocal(event.target.value) })}
                  />
                </label>
                <label>
                  到期日
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(props.draft.dueAt)}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, dueAt: parseDateTimeLocal(event.target.value) })}
                  />
                </label>
                <label>
                  提醒
                  <input
                    type="datetime-local"
                    value={formatDateTimeLocal(props.draft.reminderAt)}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, reminderAt: parseDateTimeLocal(event.target.value) })}
                  />
                </label>
                <label>
                  重复
                  <select
                    value={props.draft.repeatRule ?? "none"}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, repeatRule: event.target.value as RepeatRule })}
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
                    value={props.draft.repeatIntervalDays ?? 1}
                    disabled={!props.canEdit || ((props.draft.repeatRule ?? "none") !== "interval" && (props.draft.repeatRule ?? "none") !== "after_completion")}
                    onChange={(event) => props.setDraft({ ...props.draft, repeatIntervalDays: Number(event.target.value) })}
                  />
                </label>
                </div>
              </article>
              <article className="project-task-create-section wide">
                <p className="eyebrow">协作与子任务</p>
                <div className="project-task-create-collaboration">
                <div className="toggle-row">
                  {props.members.map((member) => (
                    <label key={member.id}>
                      <input
                        type="checkbox"
                        checked={(props.draft.collaboratorMemberIds ?? []).includes(member.id)}
                        disabled={!props.canEdit || member.id === props.draft.primaryExecutorMemberId}
                        onChange={(event) => {
                          const current = props.draft.collaboratorMemberIds ?? [];
                          props.setDraft({
                            ...props.draft,
                            collaboratorMemberIds: event.target.checked
                              ? Array.from(new Set([...current, member.id]))
                              : current.filter((id) => id !== member.id),
                          });
                        }}
                      />
                      {member.name}
                    </label>
                  ))}
                  {!props.members.length && <p className="empty">这个项目还没有成员。</p>}
                </div>
                <label>
                  初始子任务
                  <textarea
                    value={(props.draft.subtasks ?? []).join("\n")}
                    disabled={!props.canEdit}
                    onChange={(event) =>
                      props.setDraft({
                        ...props.draft,
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
            </div>
          )}
        </div>
        <div className="button-row modal-actions">
          <button className="secondary-button" onClick={props.onCancel}>
            取消
          </button>
          <button className="primary-button" disabled={!props.canEdit || !props.draft.title.trim()} onClick={props.onConfirm}>
            创建任务
          </button>
        </div>
      </section>
    </div>
  );
}
