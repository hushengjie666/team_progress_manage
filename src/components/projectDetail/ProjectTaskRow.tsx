import { Check, ChevronRight } from "lucide-react";
import { labelPriority, labelTaskStage } from "../../appModel";
import { projectTaskStatusColumns } from "../../projectTaskDisplay";
import type { ProjectMember, Task, TaskStatus } from "../../types";

export function ProjectTaskRow(props: {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  canReview: boolean;
  selectTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
}) {
  const executors = props.members.filter((member) => member.roles.includes("executor"));
  const selectedExecutor = props.task.primaryExecutorMemberId
    ? props.members.find((member) => member.id === props.task.primaryExecutorMemberId)
    : undefined;
  const executorOptions = selectedExecutor && !executors.some((member) => member.id === selectedExecutor.id)
    ? [...executors, selectedExecutor]
    : executors;

  return (
    <article className="project-task-row">
      <div>
        <strong>{props.task.title}</strong>
        <span>{labelTaskStage[props.task.stage]} · {props.task.tags.slice(0, 3).join("、") || "无标签"}</span>
      </div>
      <select
        value={props.task.primaryExecutorMemberId ?? ""}
        disabled={!props.canEdit}
        onChange={(event) => props.updateTaskAssignment(props.task.id, { primaryExecutorMemberId: event.target.value || undefined })}
      >
        <option value="">未分配</option>
        {executorOptions.map((member) => (
          <option key={member.id} value={member.id}>{member.name}</option>
        ))}
      </select>
      <select
        value={props.task.status}
        disabled={!props.canEdit || (props.task.status === "pending_review" && !props.canReview)}
        onChange={(event) => props.updateStatus(props.task.id, event.target.value as TaskStatus)}
      >
        {projectTaskStatusColumns.map((column) => (
          <option key={column.status} value={column.status}>{column.title}</option>
        ))}
      </select>
      <span className={`priority priority-${props.task.priority}`}>{labelPriority[props.task.priority]}</span>
      <span>{props.task.progressPercent ?? 0}%</span>
      <div className="button-row">
        <button className="small-button" onClick={() => props.selectTask(props.task.id)}>详情</button>
        {props.task.status !== "completed" && props.task.status !== "split" && props.task.status !== "archived" && (
          <button className="small-button" onClick={() => props.beginFocus(props.task.id)}>
            <ChevronRight size={14} />
            开始
          </button>
        )}
        {props.task.status === "pending_review" && props.canReview && (
          <span className="status-pill">
            <Check size={13} />
            可验收
          </span>
        )}
      </div>
    </article>
  );
}
