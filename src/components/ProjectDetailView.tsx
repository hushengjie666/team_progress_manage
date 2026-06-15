import { useState } from "react";
import { ArrowLeft, Check, ChevronRight, FolderKanban, Play, Settings, SlidersHorizontal, Users } from "lucide-react";
import { buildProgressBoard } from "../domain";
import { labelPriority, nowIso } from "../appModel";
import {
  filterProjectTasks,
  projectAccessForCurrentMember,
  projectTasksForProject,
  type ProjectTaskInput,
} from "../projectDetail";
import type { AppState, Priority, Project, ProjectMember, Task, TaskStatus } from "../types";
import { TaskDetailPanel } from "./WorkspaceView";

export type ProjectDetailTab = "overview" | "tasks" | "members" | "settings";

type ProjectTaskFilters = {
  query: string;
  status: "all" | TaskStatus;
  executor: "all" | "unassigned" | string;
  priority: "all" | Priority;
  sort: "status" | "priority" | "dueAt" | "updatedAt";
};

const statusColumns: { status: TaskStatus; title: string }[] = [
  { status: "pool", title: "任务池" },
  { status: "committed", title: "已安排" },
  { status: "in_progress", title: "进行中" },
  { status: "pending_review", title: "待验收" },
  { status: "completed", title: "已完成" },
  { status: "archived", title: "已归档" },
];

const initialFilters: ProjectTaskFilters = {
  query: "",
  status: "all",
  executor: "all",
  priority: "all",
  sort: "status",
};

export function ProjectDetailView(props: {
  state: AppState;
  projectId: string;
  activeTab: ProjectDetailTab;
  setActiveTab: (tab: ProjectDetailTab) => void;
  selectedTask?: Task;
  selectTask: (taskId: string | null) => void;
  createProjectTask: (projectId: string, input: ProjectTaskInput) => void;
  updateProject: (project: Project) => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  backToBoard: () => void;
  backToAdmin: () => void;
  openProjectSettings: () => void;
  openMemberSettings: () => void;
}) {
  const project = props.state.projects.find((item) => item.id === props.projectId);
  const [filters, setFilters] = useState<ProjectTaskFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(true);
  const [draft, setDraft] = useState<ProjectTaskInput>({
    title: "",
    notes: "",
    tags: [],
    priority: "medium",
    severity: "medium",
    estimatePomodoros: 1,
  });

  if (!project) {
    return (
      <section className="band project-detail-shell">
        <p className="empty">项目不存在或已被删除。</p>
        <button className="secondary-button" onClick={props.backToBoard}>返回项目总览</button>
      </section>
    );
  }

  const access = projectAccessForCurrentMember(props.state, project.id);
  const projectMembers = props.state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled");
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));
  const allProjectTasks = projectTasksForProject(props.state, project.id);
  const filteredTasks = filterProjectTasks(allProjectTasks, filters);
  const board = buildProgressBoard(props.state, project.id);
  const taskCounts = statusColumns.reduce<Record<TaskStatus, number>>((acc, column) => {
    acc[column.status] = allProjectTasks.filter((task) => task.status === column.status).length;
    return acc;
  }, { pool: 0, committed: 0, in_progress: 0, pending_review: 0, completed: 0, archived: 0 });

  const createTask = () => {
    if (!access.canEditTasks || !draft.title.trim()) return;
    props.createProjectTask(project.id, draft);
    setDraft({ title: "", notes: "", tags: [], priority: "medium", severity: "medium", estimatePomodoros: 1 });
  };

  const updateStatus = (taskId: string, status: TaskStatus) => {
    props.updateTask(taskId, {
      status,
      completedAt: status === "completed" ? nowIso() : undefined,
      reviewSubmittedAt: status === "pending_review" ? nowIso() : undefined,
      reviewSubmittedByMemberId: status === "pending_review" ? props.state.currentMemberId : undefined,
    });
  };

  if (!access.canView) {
    return (
      <section className="band project-detail-shell">
        <div className="project-detail-header">
          <button className="secondary-button" onClick={props.backToBoard}>
            <ArrowLeft size={16} />
            返回项目总览
          </button>
          <div>
            <p className="eyebrow">项目工作区</p>
            <h2>{project.name}</h2>
          </div>
        </div>
        <p className="warning-line compact">当前账号不是这个项目的成员，无法进入项目工作区。</p>
      </section>
    );
  }

  return (
    <div className="project-detail-layout">
      <section className="band project-detail-hero">
        <div className="project-detail-header">
          <button className="secondary-button" onClick={props.backToBoard}>
            <ArrowLeft size={16} />
            返回项目总览
          </button>
          <button className="secondary-button" onClick={props.backToAdmin}>
            管理中心
          </button>
        </div>
        <div className="project-detail-title">
          <div>
            <p className="eyebrow">项目工作区</p>
            <h2>{project.name}</h2>
            <p>{project.description || "这个项目还没有说明。"}</p>
          </div>
          <div className="project-detail-stats">
            <Metric label="进度" value={`${board.projectProgress}%`} />
            <Metric label="任务" value={`${allProjectTasks.length}`} />
            <Metric label="成员" value={`${projectMembers.length}`} />
            <Metric label="待验收" value={`${taskCounts.pending_review}`} />
          </div>
        </div>
        <div className="segmented project-detail-tabs">
          {([
            ["overview", "概览"],
            ["tasks", "任务"],
            ["members", "成员"],
            ["settings", "设置"],
          ] as const).map(([tab, label]) => (
            <button className={props.activeTab === tab ? "active" : ""} key={tab} onClick={() => props.setActiveTab(tab)}>
              {label}
            </button>
          ))}
        </div>
      </section>

      {props.activeTab === "overview" && (
        <>
          <section className="band project-overview-grid">
            <div className="board-summary">
              {statusColumns.map((column) => (
                <div key={column.status}>
                  <span>{column.title}</span>
                  <strong>{taskCounts[column.status]}</strong>
                </div>
              ))}
            </div>
          </section>
          <section className="band progress-board">
            <div className="section-title">
              <div>
                <p className="eyebrow">项目状态</p>
                <h2>风险与执行信号</h2>
              </div>
              <span className="count-pill">{board.sections.filter((section) => section.kind !== "normal").reduce((sum, section) => sum + section.tasks.length, 0)}</span>
            </div>
            <div className="active-session-list">
              {board.activeSessions.length === 0 && <p className="empty">当前项目没有正在执行的工作会话。</p>}
              {board.activeSessions.map((session) => (
                <article className="active-work-line" key={session.workSessionId}>
                  <div>
                    <strong>{session.taskTitle}</strong>
                    <span>{session.executorName ?? "未指定执行者"} · 已开始</span>
                  </div>
                  <button className="small-button" onClick={() => props.selectTask(session.taskId)}>查看</button>
                </article>
              ))}
            </div>
            <div className="board-section-list">
              {board.sections.map((section) => (
                <div className={`board-section board-section-${section.kind}`} key={section.kind}>
                  <div className="board-section-heading">
                    <strong>{section.title}</strong>
                    <span>{section.tasks.length}</span>
                  </div>
                  {section.tasks.length === 0 && <p className="empty">暂无任务。</p>}
                  {section.tasks.map((task) => (
                    <article className="board-task" key={`${section.kind}-${task.taskId}`}>
                      <div>
                        <strong>{task.title}</strong>
                        <span>{task.executorName ?? "未分配执行者"} · 进度 {task.progressPercent}%</span>
                        <p>{task.detail}</p>
                      </div>
                      <button className="small-button" onClick={() => props.selectTask(task.taskId)}>查看</button>
                    </article>
                  ))}
                </div>
              ))}
            </div>
          </section>
        </>
      )}

      {props.activeTab === "tasks" && (
        <section className="band project-task-workspace">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目任务</p>
              <h2>看板与任务列表</h2>
            </div>
            <button className="secondary-button" onClick={() => setShowFilters((value) => !value)}>
              <SlidersHorizontal size={16} />
              {showFilters ? "收起筛选" : "展开筛选"}
            </button>
          </div>

          <div className="project-task-create">
            <label>
              任务标题
              <input
                value={draft.title}
                disabled={!access.canEditTasks}
                onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                placeholder="这个项目下一步要推进什么"
              />
            </label>
            <label>
              执行人
              <select
                value={draft.primaryExecutorMemberId ?? ""}
                disabled={!access.canEditTasks}
                onChange={(event) => setDraft({ ...draft, primaryExecutorMemberId: event.target.value || undefined })}
              >
                <option value="">未分配</option>
                {executors.map((member) => (
                  <option key={member.id} value={member.id}>{member.name}</option>
                ))}
              </select>
            </label>
            <label>
              估算番茄
              <input
                type="number"
                min="0"
                max="30"
                value={draft.estimatePomodoros ?? 1}
                disabled={!access.canEditTasks}
                onChange={(event) => setDraft({ ...draft, estimatePomodoros: Number(event.target.value) })}
              />
            </label>
            <button className="primary-button" disabled={!access.canEditTasks || !draft.title.trim()} onClick={createTask}>
              创建项目任务
            </button>
          </div>

          {showFilters && (
            <div className="project-task-filters">
              <label>
                搜索
                <input value={filters.query} onChange={(event) => setFilters({ ...filters, query: event.target.value })} placeholder="标题、备注、标签" />
              </label>
              <label>
                状态
                <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value as ProjectTaskFilters["status"] })}>
                  <option value="all">全部状态</option>
                  {statusColumns.map((column) => (
                    <option key={column.status} value={column.status}>{column.title}</option>
                  ))}
                </select>
              </label>
              <label>
                执行人
                <select value={filters.executor} onChange={(event) => setFilters({ ...filters, executor: event.target.value })}>
                  <option value="all">全部执行人</option>
                  <option value="unassigned">未分配</option>
                  {executors.map((member) => (
                    <option key={member.id} value={member.id}>{member.name}</option>
                  ))}
                </select>
              </label>
              <label>
                优先级
                <select value={filters.priority} onChange={(event) => setFilters({ ...filters, priority: event.target.value as ProjectTaskFilters["priority"] })}>
                  <option value="all">全部优先级</option>
                  <option value="urgent">紧急</option>
                  <option value="high">高</option>
                  <option value="medium">中</option>
                  <option value="low">低</option>
                </select>
              </label>
              <label>
                排序
                <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as ProjectTaskFilters["sort"] })}>
                  <option value="status">状态顺序</option>
                  <option value="priority">优先级</option>
                  <option value="dueAt">到期日</option>
                  <option value="updatedAt">最近更新</option>
                </select>
              </label>
            </div>
          )}

          <div className="project-kanban">
            {statusColumns.map((column) => {
              const columnTasks = filteredTasks.filter((task) => task.status === column.status);
              return (
                <div className="project-kanban-column" key={column.status}>
                  <div className="board-section-heading">
                    <strong>{column.title}</strong>
                    <span>{columnTasks.length}</span>
                  </div>
                  {columnTasks.length === 0 && <p className="empty">暂无任务。</p>}
                  {columnTasks.map((task) => (
                    <ProjectTaskCard
                      key={task.id}
                      task={task}
                      members={projectMembers}
                      canEdit={access.canEditTasks}
                      canReview={access.canReviewTasks}
                      selectTask={props.selectTask}
                      beginFocus={props.beginFocus}
                      updateStatus={updateStatus}
                    />
                  ))}
                </div>
              );
            })}
          </div>

          <div className="project-task-table">
            <div className="project-task-table-head">
              <span>任务</span>
              <span>状态</span>
              <span>执行人</span>
              <span>优先级</span>
              <span>进度</span>
              <span>操作</span>
            </div>
            {filteredTasks.map((task) => (
              <ProjectTaskRow
                key={task.id}
                task={task}
                members={projectMembers}
                canEdit={access.canEditTasks}
                canReview={access.canReviewTasks}
                selectTask={props.selectTask}
                beginFocus={props.beginFocus}
                updateStatus={updateStatus}
              />
            ))}
            {filteredTasks.length === 0 && <p className="empty">当前筛选下没有任务。</p>}
          </div>
        </section>
      )}

      {props.activeTab === "members" && (
        <section className="band project-members-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目成员</p>
              <h2>成员、角色与任务负载</h2>
            </div>
            <button className="secondary-button" onClick={props.openMemberSettings}>
              <Users size={16} />
              成员库
            </button>
          </div>
          <div className="project-member-grid">
            {projectMembers.map((member) => {
              const assigned = allProjectTasks.filter((task) => task.primaryExecutorMemberId === member.id);
              return (
                <article className={member.roles.includes("project_owner") ? "project-member-card owner-card" : "project-member-card"} key={member.id}>
                  <strong>{member.name}</strong>
                  <span>{member.email ?? "未填写邮箱"}</span>
                  <div className="chip-row compact">
                    {member.roles.includes("project_owner") && <span className="chip">项目负责人</span>}
                    {member.roles.includes("executor") && <span className="chip">执行者</span>}
                  </div>
                  <small>负责任务 {assigned.length} · 待验收 {assigned.filter((task) => task.status === "pending_review").length}</small>
                </article>
              );
            })}
          </div>
          <button className="secondary-button" onClick={props.openProjectSettings}>
            <FolderKanban size={16} />
            管理项目成员绑定
          </button>
        </section>
      )}

      {props.activeTab === "settings" && (
        <section className="band project-settings-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目设置</p>
              <h2>项目资料</h2>
            </div>
            <Settings size={20} />
          </div>
          {!access.canReviewTasks && <p className="muted">只有项目负责人可以修改项目设置。</p>}
          <div className="settings-grid">
            <label>
              项目名称
              <input value={project.name} disabled={!access.canReviewTasks} onChange={(event) => props.updateProject({ ...project, name: event.target.value })} />
            </label>
            <label>
              默认预计开始（小时）
              <input
                type="number"
                min="1"
                max="720"
                value={project.defaultExpectedStartHours}
                disabled={!access.canReviewTasks}
                onChange={(event) => props.updateProject({ ...project, defaultExpectedStartHours: Number(event.target.value) })}
              />
            </label>
            <label className="span-2">
              项目说明
              <textarea value={project.description} disabled={!access.canReviewTasks} onChange={(event) => props.updateProject({ ...project, description: event.target.value })} />
            </label>
          </div>
          <button className="secondary-button" onClick={props.openProjectSettings}>
            管理成员绑定
          </button>
        </section>
      )}

      {props.selectedTask && props.selectedTask.projectId === project.id && (
        <div className="task-detail-drawer">
          <TaskDetailPanel
            task={props.selectedTask}
            projects={props.state.projects}
            projectMembers={props.state.projectMembers}
            updateTask={props.updateTask}
            updateTaskAssignment={props.updateTaskAssignment}
            updateTaskProgress={props.updateTaskProgress}
            acceptTask={props.acceptTask}
            returnTaskForReview={props.returnTaskForReview}
            close={() => props.selectTask(null)}
            splitTask={props.splitTask}
            canEdit={access.canEditTasks}
            canReview={access.canReviewTasks}
            lockProject
          />
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function memberName(members: ProjectMember[], memberId?: string) {
  return memberId ? members.find((member) => member.id === memberId)?.name ?? "未识别成员" : "未分配";
}

function ProjectTaskCard(props: {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  canReview: boolean;
  selectTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <article className="project-task-card">
      <div>
        <strong>{props.task.title}</strong>
        <span>{memberName(props.members, props.task.primaryExecutorMemberId)} · {labelPriority[props.task.priority]}</span>
      </div>
      <div className="task-progress-bar">
        <span style={{ width: `${Math.max(0, Math.min(100, props.task.progressPercent ?? 0))}%` }} />
        <strong>{props.task.progressPercent ?? 0}%</strong>
      </div>
      {props.task.notes && <p>{props.task.notes}</p>}
      <div className="button-row">
        <button className="small-button" onClick={() => props.selectTask(props.task.id)}>详情</button>
        {props.task.status !== "completed" && props.task.status !== "archived" && (
          <button className="small-button" onClick={() => props.beginFocus(props.task.id)}>
            <Play size={14} />
            开始
          </button>
        )}
        <select
          value={props.task.status}
          disabled={!props.canEdit || (props.task.status === "pending_review" && !props.canReview)}
          onChange={(event) => props.updateStatus(props.task.id, event.target.value as TaskStatus)}
        >
          {statusColumns.map((column) => (
            <option key={column.status} value={column.status}>{column.title}</option>
          ))}
        </select>
      </div>
    </article>
  );
}

function ProjectTaskRow(props: {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  canReview: boolean;
  selectTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
}) {
  return (
    <article className="project-task-row">
      <div>
        <strong>{props.task.title}</strong>
        <span>{props.task.tags.slice(0, 3).join("、") || "无标签"}</span>
      </div>
      <select
        value={props.task.status}
        disabled={!props.canEdit || (props.task.status === "pending_review" && !props.canReview)}
        onChange={(event) => props.updateStatus(props.task.id, event.target.value as TaskStatus)}
      >
        {statusColumns.map((column) => (
          <option key={column.status} value={column.status}>{column.title}</option>
        ))}
      </select>
      <span>{memberName(props.members, props.task.primaryExecutorMemberId)}</span>
      <span className={`priority priority-${props.task.priority}`}>{labelPriority[props.task.priority]}</span>
      <span>{props.task.progressPercent ?? 0}%</span>
      <div className="button-row">
        <button className="small-button" onClick={() => props.selectTask(props.task.id)}>详情</button>
        {props.task.status !== "completed" && props.task.status !== "archived" && (
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
