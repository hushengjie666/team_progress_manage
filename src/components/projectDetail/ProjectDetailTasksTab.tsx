import { Plus, SlidersHorizontal } from "lucide-react";
import type { ProjectDetailModel, ProjectTaskFilters } from "../../projectDetail";
import type { ProjectMember, Task, TaskStatus } from "../../types";
import { ProjectTaskFiltersPanel } from "./ProjectTaskFiltersPanel";
import { ProjectTaskRow } from "./ProjectTaskRow";

type ProjectDetailTasksTabProps = {
  filters: ProjectTaskFilters;
  setFilters: (filters: ProjectTaskFilters) => void;
  showFilters: boolean;
  toggleFilters: () => void;
  executors: ProjectDetailModel["executors"];
  filteredTasks: ProjectDetailModel["filteredTasks"];
  projectMembers: ProjectMember[];
  canEditTasks: boolean;
  canReviewTasks: boolean;
  selectTask: (taskId: string | null) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
  updateTaskAssignment: (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => void;
  openCreateTaskDialog: () => void;
};

export function ProjectDetailTasksTab({
  filters,
  setFilters,
  showFilters,
  toggleFilters,
  executors,
  filteredTasks,
  projectMembers,
  canEditTasks,
  canReviewTasks,
  selectTask,
  beginFocus,
  updateStatus,
  updateTaskAssignment,
  openCreateTaskDialog,
}: ProjectDetailTasksTabProps) {
  return (
    <section className="band project-task-workspace">
      <div className="section-title">
        <div>
          <p className="eyebrow">项目任务</p>
          <h2>创建与任务列表</h2>
        </div>
        <div className="button-row">
          <button className="primary-button compact-button" disabled={!canEditTasks} onClick={openCreateTaskDialog}>
            <Plus size={16} />
            添加任务
          </button>
          <button className="secondary-button" onClick={toggleFilters}>
            <SlidersHorizontal size={16} />
            {showFilters ? "收起筛选" : "筛选"}
          </button>
        </div>
      </div>

      {showFilters && <ProjectTaskFiltersPanel filters={filters} setFilters={setFilters} executors={executors} />}

      <div className="project-task-table">
        <div className="project-task-table-head">
          <span>任务</span>
          <span>执行人</span>
          <span>状态</span>
          <span>优先级</span>
          <span>进度</span>
          <span>操作</span>
        </div>
        {filteredTasks.map((task: Task) => (
          <ProjectTaskRow
            key={task.id}
            task={task}
            members={projectMembers}
            canEdit={canEditTasks}
            canReview={canReviewTasks}
            selectTask={selectTask}
            beginFocus={beginFocus}
            updateStatus={updateStatus}
            updateTaskAssignment={updateTaskAssignment}
          />
        ))}
        {filteredTasks.length === 0 && <p className="empty">当前筛选下没有任务。</p>}
      </div>
    </section>
  );
}
