import { Check, Target } from "lucide-react";
import type { Task } from "../../types";
import { PomodoroProgress } from "./PomodoroProgress";

export function FocusCurrentTaskPanel(props: {
  currentTask?: Task;
  completeTask: (taskId: string) => void;
}) {
  const { currentTask } = props;
  const isPendingReview = currentTask?.status === "pending_review";

  return (
    <div className="focus-current-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">当前工作</p>
          <h2>当下清单</h2>
        </div>
        <Target size={20} />
      </div>
      {currentTask ? (
        <div className="focus-current-content">
          <div>
            <strong>{currentTask.title}</strong>
            <p>{currentTask.notes || "番茄期间只做这一件事。"}</p>
          </div>
          <PomodoroProgress actual={currentTask.actualPomodoros} estimate={currentTask.estimatePomodoros} />
          <div className="task-meta">
            <span>{currentTask.project}</span>
          </div>
          {isPendingReview ? (
            <button className="small-button" disabled>
              <Check size={15} />
              已提交验收
            </button>
          ) : (
            <button className="small-button" onClick={() => props.completeTask(currentTask.id)}>
              <Check size={15} />
              提交验收
            </button>
          )}
        </div>
      ) : (
        <p className="empty">工作队列为空，先从左侧清单选择任务。</p>
      )}
    </div>
  );
}
