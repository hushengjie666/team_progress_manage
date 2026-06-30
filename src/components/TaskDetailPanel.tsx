import type React from "react";
import { useEffect, useState } from "react";
import { AlarmClock, Check, PanelRight, Plus, Split, Trash2, X } from "lucide-react";
import { estimateDeltaLabel } from "../domain";
import { formatDateTimeLocal, nowIso, parseDateTimeLocal, taskStageOptions } from "../appModel";
import { uid } from "../seed";
import type { AppState, Priority, ProjectMember, RepeatRule, Severity, Subtask, Task, TaskStage } from "../types";

export function TaskDetailModal(props: React.ComponentProps<typeof TaskDetailPanel>) {
  useEffect(() => {
    if (!props.task) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  if (!props.task) return null;

  return (
    <div
      className="modal-backdrop task-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.close();
      }}
    >
      <section className="modal-panel task-detail-modal" role="dialog" aria-modal="true" aria-label={`任务详情：${props.task.title}`}>
        <TaskDetailPanel {...props} />
      </section>
    </div>
  );
}

export function TaskDetailPanel(props: {
  task?: Task;
  projects: AppState["projects"];
  projectMembers: ProjectMember[];
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  close: () => void;
  splitTask: (taskId: string) => void;
  canEdit?: boolean;
  canReview?: boolean;
  lockProject?: boolean;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [returnReason, setReturnReason] = useState("");
  const { task, updateTask } = props;
  const canEdit = props.canEdit ?? true;
  const canReview = props.canReview ?? true;

  if (!task) {
    return (
      <section className="band task-detail empty-detail">
        <div className="section-title">
          <div>
            <p className="eyebrow">Task Detail</p>
            <h2>任务详情</h2>
          </div>
          <PanelRight size={20} />
        </div>
        <p className="empty">选择一个任务后，可以编辑到期日、提醒、重复、子任务和估算反馈。</p>
      </section>
    );
  }

  const addSubtask = () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: [
        ...(current.subtasks ?? []),
        { id: uid("subtask"), title, completed: false, createdAt: nowIso() },
      ],
    }));
    setSubtaskTitle("");
  };

  const updateSubtask = (subtaskId: string, patch: Partial<Subtask>) => {
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: (current.subtasks ?? []).map((subtask) =>
        subtask.id === subtaskId
          ? {
              ...subtask,
              ...patch,
              completedAt: patch.completed ? nowIso() : patch.completed === false ? undefined : subtask.completedAt,
            }
          : subtask,
      ),
    }));
  };

  const completedSubtasks = (task.subtasks ?? []).filter((subtask) => subtask.completed).length;
  const taskProject = props.projects.find((project) => project.id === task.projectId) ?? props.projects[0];
  const projectMembers = props.projectMembers.filter((member) => member.projectId === taskProject?.id);
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));
  const collaboratorIds = task.collaboratorMemberIds ?? [];
  const toggleCollaborator = (memberId: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...collaboratorIds, memberId]))
      : collaboratorIds.filter((id) => id !== memberId);
    props.updateTaskAssignment(task.id, { collaboratorMemberIds: nextIds });
  };

  return (
    <section className="band task-detail">
      <div className="section-title">
        <div>
          <p className="eyebrow">Task Detail</p>
          <h2>任务详情</h2>
        </div>
        <button className="icon-button small" title="关闭详情" onClick={props.close}>
          <X size={16} />
        </button>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <strong>基本信息</strong>
          <span>任务是什么、属于哪个项目、优先级如何。</span>
        </div>
        <div className="detail-grid">
          <label className="span-2">
            标题
            <input value={task.title} disabled={!canEdit} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
          </label>
          <label>
            项目
            {props.lockProject ? (
              <input value={taskProject?.name ?? "未命名项目"} disabled />
            ) : (
              <select
                value={taskProject?.id ?? ""}
                disabled={!canEdit}
                onChange={(event) =>
                  props.updateTaskAssignment(task.id, {
                    projectId: event.target.value,
                    primaryExecutorMemberId: "",
                    collaboratorMemberIds: [],
                  })
                }
              >
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            )}
          </label>
          <label>
            标签
            <input
              value={task.tags.join(", ")}
              disabled={!canEdit}
              onChange={(event) =>
                updateTask(task.id, {
                  tags: event.target.value
                    .split(/[,\s，]+/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            优先级
            <select value={task.priority} disabled={!canEdit} onChange={(event) => updateTask(task.id, { priority: event.target.value as Priority })}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label>
            阶段
            <select value={task.stage} disabled={!canEdit} onChange={(event) => updateTask(task.id, { stage: event.target.value as TaskStage })}>
              {taskStageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            严重度
            <select value={task.severity} disabled={!canEdit} onChange={(event) => updateTask(task.id, { severity: event.target.value as Severity })}>
              <option value="very_high">非常高</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label className="span-2">
            备注
            <textarea value={task.notes} disabled={!canEdit} onChange={(event) => updateTask(task.id, { notes: event.target.value })} />
          </label>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <strong>执行与进展</strong>
          <span>谁负责、做了多少、现在卡在哪里。</span>
        </div>
        <div className="detail-grid">
          <label>
            主执行人
            <select
              value={task.primaryExecutorMemberId ?? ""}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskAssignment(task.id, { primaryExecutorMemberId: event.target.value })}
            >
              <option value="">未分配</option>
              {executors.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label>
            进度百分比
            <input
              type="number"
              min="0"
              max="100"
              value={task.progressPercent ?? 0}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskProgress(task.id, Number(event.target.value), task.progressNote ?? "")}
            />
          </label>
          <label>
            估算番茄
            <input
              type="number"
              min="0"
              max="30"
              value={task.estimatePomodoros}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { estimatePomodoros: Number(event.target.value) })}
            />
          </label>
          <label>
            实际番茄
            <input
              type="number"
              min="0"
              value={task.actualPomodoros}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { actualPomodoros: Number(event.target.value) })}
            />
          </label>
          <label className="span-2">
            进展说明
            <textarea
              value={task.progressNote ?? ""}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskProgress(task.id, task.progressPercent ?? 0, event.target.value)}
              placeholder="说明刚完成了什么、还剩什么，或为什么偏离预期"
            />
          </label>
        </div>
      </div>

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

      <div className="detail-summary">
        <Metric icon={<Check size={17} />} label="子任务" value={`${completedSubtasks}/${task.subtasks.length}`} />
        <Metric icon={<AlarmClock size={17} />} label="偏差" value={estimateDeltaLabel(task.estimatePomodoros, task.actualPomodoros)} />
      </div>

      {task.reviewReturnReason && task.status !== "pending_review" && (
        <p className="warning-line compact">最近退回原因：{task.reviewReturnReason}</p>
      )}

      {task.status === "pending_review" && canReview && (
        <div className="subtask-box">
          <div className="section-title compact-title">
            <div>
              <p className="eyebrow">任务验收</p>
              <h2>任务验收</h2>
            </div>
          </div>
          <p className="muted">执行者已提交验收。只有验收通过后，这项任务才会进入已完成。</p>
          <label>
            退回原因
            <textarea
              value={returnReason}
              disabled={!canReview}
              onChange={(event) => setReturnReason(event.target.value)}
              placeholder="说明未通过的原因和需要补齐的结果"
            />
          </label>
          <div className="button-row">
            <button className="primary-button" disabled={!canReview} onClick={() => props.acceptTask(task.id)}>
              <Check size={16} />
              验收通过
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                props.returnTaskForReview(task.id, returnReason);
                setReturnReason("");
              }}
              disabled={!canReview || !returnReason.trim()}
            >
              退回任务
            </button>
          </div>
        </div>
      )}

      <div className="subtask-box">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">子任务</p>
            <h2>子任务</h2>
          </div>
        </div>
        <div className="subtask-add">
          <input
            value={subtaskTitle}
            disabled={!canEdit}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            placeholder="添加子任务"
          />
          <button className="secondary-button" disabled={!canEdit} onClick={addSubtask}>
            <Plus size={16} />
            添加
          </button>
        </div>
        <div className="subtask-list">
          {task.subtasks.map((subtask) => (
            <label className="subtask-row" key={subtask.id}>
              <input
                type="checkbox"
                checked={subtask.completed}
                disabled={!canEdit}
                onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })}
              />
              <span className={subtask.completed ? "done" : ""}>{subtask.title}</span>
              <button
                type="button"
                className="icon-button small"
                title="删除子任务"
                disabled={!canEdit}
                onClick={() =>
                  updateTask(task.id, (current) => ({
                    ...current,
                    subtasks: current.subtasks.filter((item) => item.id !== subtask.id),
                  }))
                }
              >
                <Trash2 size={15} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {task.status !== "completed" && task.status !== "split" && task.status !== "archived" && (
        <button className="primary-button" disabled={!canEdit} onClick={() => props.splitTask(task.id)}>
          <Split size={16} />
          {task.estimatePomodoros > 7 ? "拆分大任务" : "拆分任务"}
        </button>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

