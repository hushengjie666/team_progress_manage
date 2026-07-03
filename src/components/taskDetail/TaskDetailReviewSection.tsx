import type { Dispatch, SetStateAction } from "react";
import { Check } from "lucide-react";
import type { Task } from "../../types";

type TaskDetailReviewSectionProps = {
  task: Task;
  canReview: boolean;
  returnReason: string;
  setReturnReason: Dispatch<SetStateAction<string>>;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
};

export function TaskDetailReviewSection({
  task,
  canReview,
  returnReason,
  setReturnReason,
  acceptTask,
  returnTaskForReview,
}: TaskDetailReviewSectionProps) {
  if (task.status !== "pending_review" || !canReview) return null;

  return (
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
        <button className="primary-button" disabled={!canReview} onClick={() => acceptTask(task.id)}>
          <Check size={16} />
          验收通过
        </button>
        <button
          className="secondary-button"
          onClick={() => {
            returnTaskForReview(task.id, returnReason);
            setReturnReason("");
          }}
          disabled={!canReview || !returnReason.trim()}
        >
          退回任务
        </button>
      </div>
    </div>
  );
}
