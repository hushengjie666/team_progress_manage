import { useState } from "react";
import { PanelRight, X } from "lucide-react";
import { TaskDetailBasicInfoSection } from "./taskDetail/TaskDetailBasicInfoSection";
import { TaskDetailCollaboratorsSection } from "./taskDetail/TaskDetailCollaboratorsSection";
import type { TaskDetailPanelProps } from "./taskDetail/taskDetailPanelTypes";
import { TaskDetailProgressSection } from "./taskDetail/TaskDetailProgressSection";
import { TaskDetailReviewSection } from "./taskDetail/TaskDetailReviewSection";
import { TaskDetailScheduleSection } from "./taskDetail/TaskDetailScheduleSection";
import { TaskDetailSplitAction } from "./taskDetail/TaskDetailSplitAction";
import { TaskDetailSubtasksSection } from "./taskDetail/TaskDetailSubtasksSection";
import { TaskDetailSummary } from "./taskDetail/TaskDetailSummary";

export function TaskDetailPanel(props: TaskDetailPanelProps) {
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

  const taskProject = props.projects.find((project) => project.id === task.projectId) ?? props.projects[0];
  const projectMembers = props.projectMembers.filter((member) => member.projectId === taskProject?.id);
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));

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

      <TaskDetailBasicInfoSection
        task={task}
        projects={props.projects}
        taskProject={taskProject}
        canEdit={canEdit}
        lockProject={props.lockProject}
        updateTask={updateTask}
        updateTaskAssignment={props.updateTaskAssignment}
      />
      <TaskDetailProgressSection
        task={task}
        executors={executors}
        canEdit={canEdit}
        updateTask={updateTask}
        updateTaskAssignment={props.updateTaskAssignment}
        updateTaskProgress={props.updateTaskProgress}
      />
      <TaskDetailScheduleSection task={task} canEdit={canEdit} updateTask={updateTask} />
      <TaskDetailCollaboratorsSection
        task={task}
        projectMembers={projectMembers}
        canEdit={canEdit}
        updateTaskAssignment={props.updateTaskAssignment}
      />
      <TaskDetailSummary task={task} />

      {task.reviewReturnReason && task.status !== "pending_review" && (
        <p className="warning-line compact">最近退回原因：{task.reviewReturnReason}</p>
      )}

      <TaskDetailReviewSection
        task={task}
        canReview={canReview}
        returnReason={returnReason}
        setReturnReason={setReturnReason}
        acceptTask={props.acceptTask}
        returnTaskForReview={props.returnTaskForReview}
      />

      <TaskDetailSubtasksSection task={task} canEdit={canEdit} updateTask={updateTask} />
      <TaskDetailSplitAction task={task} canEdit={canEdit} splitTask={props.splitTask} />
    </section>
  );
}

export type { TaskDetailPanelProps } from "./taskDetail/taskDetailPanelTypes";
