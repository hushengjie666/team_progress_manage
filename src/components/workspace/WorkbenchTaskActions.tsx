import type React from "react";
import { Activity, ArrowDown, ArrowUp, Check, PanelRight, Split, Trash2, X } from "lucide-react";
import type { Task } from "../../types";

type WorkbenchTaskActionsProps = {
  task: Task;
  actionLabel: string;
  actionIcon: React.ReactNode;
  isCompletedTask: boolean;
  hasTimerState: boolean;
  isPausedTask: boolean;
  canSubmitReview: boolean;
  onAction: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  onSplit?: (taskId: string) => void;
  onMove?: (taskId: string, direction: -1 | 1) => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
};

export function WorkbenchTaskActions({
  task,
  actionLabel,
  actionIcon,
  isCompletedTask,
  hasTimerState,
  isPausedTask,
  canSubmitReview,
  onAction,
  onDelete,
  onRemove,
  onComplete,
  onSelect,
  onSplit,
  onMove,
  canMoveUp,
  canMoveDown,
}: WorkbenchTaskActionsProps) {
  const canSplitTask = task.status !== "completed" && task.status !== "split" && task.status !== "archived";

  return (
    <div className="task-actions">
      <div className="task-secondary-actions">
        {onMove && (
          <>
            <button className="icon-button small mobile-sort-action" title="上移任务" disabled={!canMoveUp} onClick={() => onMove(task.id, -1)}>
              <ArrowUp size={16} />
            </button>
            <button className="icon-button small mobile-sort-action" title="下移任务" disabled={!canMoveDown} onClick={() => onMove(task.id, 1)}>
              <ArrowDown size={16} />
            </button>
          </>
        )}
        {onSelect && (
          <button className="icon-button small" title="任务详情" onClick={() => onSelect(task.id)}>
            <PanelRight size={16} />
          </button>
        )}
        {onSplit && canSplitTask && (
          <button className="icon-button small" title="拆分任务" onClick={() => onSplit(task.id)}>
            <Split size={16} />
          </button>
        )}
        {onComplete && canSubmitReview && (
          <button className="icon-button small" title="提交验收" onClick={() => onComplete(task.id)}>
            <Check size={16} />
          </button>
        )}
        {onRemove && (
          <button className="icon-button small" title="移回活动清单" onClick={() => onRemove(task.id)}>
            <X size={16} />
          </button>
        )}
        {onDelete && (
          <button className="icon-button small danger" title="删除任务" onClick={() => onDelete(task.id)}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className="task-primary-actions">
        {isCompletedTask ? (
          <span className="small-button active-action completed-action" aria-label="今日已完成的任务">
            <Check size={15} />
            已完成
          </span>
        ) : hasTimerState ? (
          <span className="small-button active-action" aria-label="当前正在执行的任务">
            <Activity className="active-action-icon" size={15} />
            {isPausedTask ? "已暂停" : "执行中"}
          </span>
        ) : (
          <button className="small-button task-primary-action" onClick={() => onAction(task.id)}>
            {actionIcon}
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  );
}
