import { useEffect, useState } from "react";
import { Check, ChevronRight, Eye, Play, Plus, Settings, SlidersHorizontal, Users, X } from "lucide-react";
import { buildProgressBoard } from "../domain";
import { formatDateTimeLocal, labelPriority, labelSeverity, labelTaskStage, nowIso, parseDateTimeLocal, taskStageOptions, today } from "../appModel";
import {
  buildProjectOverviewTaskBoard,
  filterProjectTasks,
  projectAccessForCurrentMember,
  projectTasksForProject,
  type ProjectTaskInput,
  type ProjectOverviewTaskGroup,
} from "../projectDetail";
import type { AppState, Priority, Project, ProjectMember, ProjectMemberRole, RepeatRule, Severity, Task, TaskStage, TaskStatus, TeamMember } from "../types";
import { TaskDetailModal } from "./WorkspaceView";

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
  { status: "split", title: "已拆分" },
  { status: "archived", title: "已归档" },
];
const overviewStatusColumns = statusColumns.filter((column) => column.status !== "committed" && column.status !== "split" && column.status !== "archived");
const statusTitleByStatus = Object.fromEntries(statusColumns.map((column) => [column.status, column.title])) as Record<TaskStatus, string>;

const initialFilters: ProjectTaskFilters = {
  query: "",
  status: "all",
  executor: "all",
  priority: "all",
  sort: "status",
};

const createEmptyProjectTaskDraft = (): ProjectTaskInput => ({
  title: "",
  notes: "",
  tags: [],
  priority: "medium",
  severity: "medium",
  stage: "requirements",
  estimateHours: 1,
  collaboratorMemberIds: [],
  repeatRule: "none",
  repeatIntervalDays: 1,
  subtasks: [],
});

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
  bindTeamMemberToProject: (projectId: string, teamMemberId: string, roles: ProjectMemberRole[]) => void;
  updateProjectMember: (member: ProjectMember) => void;
  backToBoard: () => void;
  backToAdmin: () => void;
  openMemberSettings: () => void;
}) {
  const project = props.state.projects.find((item) => item.id === props.projectId);
  const [filters, setFilters] = useState<ProjectTaskFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [draft, setDraft] = useState<ProjectTaskInput>(createEmptyProjectTaskDraft);

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
  const overviewTasks = allProjectTasks.filter((task) => task.status !== "split" && task.status !== "archived");
  const todayPlan = props.state.dailyPlans.find((plan) => plan.date === today());
  const activeProjectTaskIds = props.state.workSessions
    .filter((session) => (session.status === "active" || session.status === "paused") && allProjectTasks.some((task) => task.id === session.taskId))
    .map((session) => session.taskId);
  const overviewBoard = buildProjectOverviewTaskBoard(allProjectTasks, projectMembers, activeProjectTaskIds, todayPlan?.committedTaskIds ?? []);
  const filteredTasks = filterProjectTasks(allProjectTasks, filters);
  const board = buildProgressBoard(props.state, project.id);
  const taskCounts = statusColumns.reduce<Record<TaskStatus, number>>((acc, column) => {
    acc[column.status] = allProjectTasks.filter((task) => task.status === column.status).length;
    return acc;
  }, { pool: 0, committed: 0, in_progress: 0, pending_review: 0, completed: 0, split: 0, archived: 0 });

  const createTask = () => {
    if (!access.canEditTasks || !draft.title.trim()) return;
    props.createProjectTask(project.id, draft);
    setDraft(createEmptyProjectTaskDraft());
    setShowCreateTaskDialog(false);
  };

  const updateStatus = (taskId: string, status: TaskStatus) => {
    props.updateTask(taskId, {
      status,
      completedAt: status === "completed" ? nowIso() : undefined,
      reviewSubmittedAt: status === "pending_review" ? nowIso() : undefined,
      reviewSubmittedByMemberId: status === "pending_review" ? props.state.currentMemberId : undefined,
    });
  };
  const updateMemberRole = (member: ProjectMember, role: ProjectMemberRole, checked: boolean) => {
    const roles = checked ? Array.from(new Set([...member.roles, role])) : member.roles.filter((item) => item !== role);
    props.updateProjectMember({ ...member, roles });
  };

  return (
    <div className="project-detail-layout">
      <section className="band project-detail-hero">
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
        <div className="project-detail-stats">
          <Metric label="进度" value={`${board.projectProgress}%`} />
          <Metric label="任务" value={`${allProjectTasks.length}`} />
          <Metric label="成员" value={`${projectMembers.length}`} />
          <Metric label="待验收" value={`${taskCounts.pending_review}`} />
        </div>
      </section>

      {props.activeTab === "overview" && (
        <>
          <section className="band project-task-workspace project-overview-task-board">
            <div className="section-title">
              <div className="project-board-title">
                <span className="count-pill">{overviewBoard.poolTasks.length + overviewBoard.pendingReviewTasks.length + overviewBoard.inProgressTasks.length}</span>
                <h2>任务状态看板</h2>
              </div>
              <button className="primary-button compact-button" disabled={!access.canEditTasks} onClick={() => setShowCreateTaskDialog(true)}>
                <Plus size={16} />
                添加任务
              </button>
            </div>
            <ProjectOverviewTaskBoard
              poolTasks={overviewBoard.poolTasks}
              pendingReviewTasks={overviewBoard.pendingReviewTasks}
              todayWorkGroups={overviewBoard.todayWorkGroups}
              members={projectMembers}
              selectTask={props.selectTask}
              activeTaskIds={activeProjectTaskIds}
            />
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
              <h2>创建与任务列表</h2>
            </div>
            <div className="button-row">
              <button className="primary-button compact-button" disabled={!access.canEditTasks} onClick={() => setShowCreateTaskDialog(true)}>
                <Plus size={16} />
                添加任务
              </button>
              <button className="secondary-button" onClick={() => setShowFilters((value) => !value)}>
                <SlidersHorizontal size={16} />
                {showFilters ? "收起筛选" : "筛选"}
              </button>
            </div>
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
                updateTaskAssignment={props.updateTaskAssignment}
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
                  <span>{member.email ?? "未填写登录信息"}</span>
                  <div className="chip-row compact">
                    {member.roles.includes("project_owner") && <span className="chip">项目负责人</span>}
                    {member.roles.includes("executor") && <span className="chip">执行者</span>}
                  </div>
                  <small>负责任务 {assigned.length} · 待验收 {assigned.filter((task) => task.status === "pending_review").length}</small>
                </article>
              );
            })}
          </div>
          <ProjectMemberBindingPanel
            project={project}
            teamMembers={props.state.teamMembers.filter((member) => member.status !== "disabled")}
            projectMembers={props.state.projectMembers}
            canManage={access.canReviewTasks}
            bindTeamMemberToProject={props.bindTeamMemberToProject}
            updateMemberRole={updateMemberRole}
            updateProjectMember={props.updateProjectMember}
          />
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
          <button className="secondary-button" onClick={() => props.setActiveTab("members")}>
            前往成员管理
          </button>
        </section>
      )}

      <TaskDetailModal
        task={props.selectedTask?.projectId === project.id ? props.selectedTask : undefined}
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
      <ProjectTaskCreateDialog
        open={showCreateTaskDialog}
        draft={draft}
        members={projectMembers}
        executors={executors}
        canEdit={access.canEditTasks}
        setDraft={setDraft}
        onCancel={() => setShowCreateTaskDialog(false)}
        onConfirm={createTask}
      />
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

function ProjectTaskCreateDialog(props: {
  open: boolean;
  draft: ProjectTaskInput;
  members: ProjectMember[];
  executors: ProjectMember[];
  canEdit: boolean;
  setDraft: (draft: ProjectTaskInput) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const [showAdvanced, setShowAdvanced] = useState(true);
  useEffect(() => {
    if (props.open) setShowAdvanced(true);
  }, [props.open]);

  if (!props.open) return null;
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
                <div className="project-task-create-dialog-form advanced">
                <label>
                  标签
                  <input
                    value={(props.draft.tags ?? []).join(", ")}
                    disabled={!props.canEdit}
                    onChange={(event) =>
                      props.setDraft({
                        ...props.draft,
                        tags: event.target.value
                          .split(/[,\s，]+/)
                          .map((item) => item.trim())
                          .filter(Boolean),
                      })
                    }
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
                  阶段
                  <select
                    value={props.draft.stage ?? "requirements"}
                    disabled={!props.canEdit}
                    onChange={(event) => props.setDraft({ ...props.draft, stage: event.target.value as TaskStage })}
                  >
                    {taskStageOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
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

function ProjectOverviewTaskBoard(props: {
  poolTasks: Task[];
  pendingReviewTasks: Task[];
  todayWorkGroups: ProjectOverviewTaskGroup[];
  members: ProjectMember[];
  selectTask: (taskId: string) => void;
  activeTaskIds: string[];
}) {
  const activeTaskIdSet = new Set(props.activeTaskIds);
  return (
    <div className="project-overview-board">
      <section className="project-overview-pool">
        <div className="board-section-heading">
          <strong>任务池</strong>
          <span>{props.poolTasks.length}</span>
        </div>
        <div className="project-overview-pool-list">
          {props.poolTasks.length === 0 && <p className="empty">暂无待安排任务。</p>}
          {props.poolTasks.map((task) => (
            <ProjectTaskCard
              key={task.id}
              task={task}
              members={props.members}
              canEdit={false}
              canReview={false}
              selectTask={props.selectTask}
              beginFocus={() => undefined}
              updateStatus={() => undefined}
              compact
            />
          ))}
        </div>
      </section>

      <section className="project-overview-review">
        <div className="board-section-heading">
          <strong>待验收</strong>
          <span>{props.pendingReviewTasks.length}</span>
        </div>
        <div className="project-overview-pool-list">
          {props.pendingReviewTasks.length === 0 && <p className="empty">暂无待验收任务。</p>}
          {props.pendingReviewTasks.map((task) => (
            <ProjectTaskCard
              key={task.id}
              task={task}
              members={props.members}
              canEdit={false}
              canReview={false}
              selectTask={props.selectTask}
              beginFocus={() => undefined}
              updateStatus={() => undefined}
              compact
            />
          ))}
        </div>
      </section>

      <section className="project-overview-running">
        <div className="board-section-heading">
          <strong>今日准备执行</strong>
          <span>{props.todayWorkGroups.reduce((sum, group) => sum + group.tasks.length, 0)}</span>
        </div>
        <div className="project-member-work-grid">
          {props.todayWorkGroups.length === 0 && <p className="empty">当前项目暂无成员。</p>}
          {props.todayWorkGroups.map((group) => (
            <article
              className={[
                "project-member-work-card",
                group.hasActiveTask ? "active" : "",
                group.tasks.length === 0 ? "idle" : "",
              ].filter(Boolean).join(" ")}
              key={group.memberId ?? "unassigned"}
            >
              <div className="project-member-work-header">
                <div className="project-member-work-identity">
                  <span className="member-avatar" aria-hidden="true">{group.memberName.slice(0, 1)}</span>
                  <div>
                    <strong>{group.memberName}</strong>
                    <span>{group.tasks.length} 个今日任务</span>
                  </div>
                </div>
                {group.hasActiveTask && <span className="running-pill">正在执行</span>}
              </div>
              <div className="project-member-work-list">
                {group.tasks.length === 0 && <p className="project-member-idle">今日暂无准备执行任务</p>}
                {group.tasks.map((task) => {
                  const isActive = activeTaskIdSet.has(task.id);
                  return (
                    <button
                      className={isActive ? "project-member-work-task active" : "project-member-work-task"}
                      key={task.id}
                      onClick={() => props.selectTask(task.id)}
                      type="button"
                    >
                      <div>
                        <strong>{task.title}</strong>
                        <span>{statusTitleByStatus[task.status]} · {labelPriority[task.priority]} · {task.progressPercent ?? 0}% · {task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
                      </div>
                      {isActive ? <span className="running-pill">当前</span> : <Eye size={14} />}
                    </button>
                  );
                })}
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProjectTaskKanban(props: {
  tasks: Task[];
  members: ProjectMember[];
  canEdit: boolean;
  canReview: boolean;
  selectTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
  columns?: { status: TaskStatus; title: string }[];
  compact?: boolean;
}) {
  const availableColumns = props.columns ?? statusColumns;
  const columns = props.compact
    ? availableColumns.filter((column) => props.tasks.some((task) => task.status === column.status))
    : availableColumns;

  return (
    <div className={props.compact ? "project-kanban compact-kanban" : "project-kanban"}>
      {columns.length === 0 && <p className="empty">暂无任务。</p>}
      {columns.map((column) => {
        const columnTasks = props.tasks.filter((task) => task.status === column.status);
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
                members={props.members}
                canEdit={props.canEdit}
                canReview={props.canReview}
                selectTask={props.selectTask}
                beginFocus={props.beginFocus}
                updateStatus={props.updateStatus}
                compact={props.compact}
              />
            ))}
          </div>
        );
      })}
    </div>
  );
}

function ProjectMemberBindingPanel({
  project,
  teamMembers,
  projectMembers,
  canManage,
  bindTeamMemberToProject,
  updateMemberRole,
  updateProjectMember,
}: {
  project: Project;
  teamMembers: TeamMember[];
  projectMembers: ProjectMember[];
  canManage: boolean;
  bindTeamMemberToProject: (projectId: string, teamMemberId: string, roles: ProjectMemberRole[]) => void;
  updateMemberRole: (member: ProjectMember, role: ProjectMemberRole, checked: boolean) => void;
  updateProjectMember: (member: ProjectMember) => void;
}) {
  const bindings = projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled");
  const bindingFor = (teamMemberId: string) => bindings.find((member) => member.teamMemberId === teamMemberId);

  return (
    <section className="project-binding-panel inline-project-binding">
      <div className="member-section-title">
        <strong>项目成员管理</strong>
        <span>从成员库选择成员，并维护这个项目内的角色。</span>
      </div>
      <div className="project-binding-list">
        {teamMembers.map((teamMember) => {
          const binding = bindingFor(teamMember.id);
          const isBound = Boolean(binding);
          return (
            <article className={isBound ? "project-binding-row bound" : "project-binding-row"} key={teamMember.id}>
              <div>
                <strong>{teamMember.name}</strong>
                <span>{teamMember.email ?? "未填写登录信息"}</span>
              </div>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={binding?.roles.includes("project_owner") ?? false}
                  disabled={!canManage || !binding}
                  onChange={(event) => binding && updateMemberRole(binding, "project_owner", event.target.checked)}
                />
                项目负责人
              </label>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={binding?.roles.includes("executor") ?? false}
                  disabled={!canManage || !binding}
                  onChange={(event) => binding && updateMemberRole(binding, "executor", event.target.checked)}
                />
                执行者
              </label>
              {isBound ? (
                <button className="secondary-button" disabled={!canManage} onClick={() => binding && updateProjectMember({ ...binding, status: "disabled" })}>
                  解除绑定
                </button>
              ) : (
                <button className="primary-button" disabled={!canManage} onClick={() => bindTeamMemberToProject(project.id, teamMember.id, ["executor"])}>
                  绑定到项目
                </button>
              )}
            </article>
          );
        })}
        {!teamMembers.length && <p className="empty">成员库为空，请先到“成员库”创建成员。</p>}
      </div>
    </section>
  );
}

function ProjectTaskCard(props: {
  task: Task;
  members: ProjectMember[];
  canEdit: boolean;
  canReview: boolean;
  selectTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateStatus: (taskId: string, status: TaskStatus) => void;
  compact?: boolean;
}) {
  if (props.compact) {
    return (
      <article className="project-task-card compact-task-card">
        <div className="compact-task-main">
          <strong>{props.task.title}</strong>
          <span>{memberName(props.members, props.task.primaryExecutorMemberId)} · {labelTaskStage[props.task.stage]} · {props.task.progressPercent ?? 0}%</span>
          <div className="compact-task-progress" aria-label={`任务进度 ${props.task.progressPercent ?? 0}%`}>
            <span style={{ width: `${Math.max(0, Math.min(100, props.task.progressPercent ?? 0))}%` }} />
          </div>
        </div>
        <div className="compact-task-actions">
          <button className="icon-button small" title="详情" onClick={() => props.selectTask(props.task.id)}>
            <Eye size={13} />
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="project-task-card">
      <div>
        <strong>{props.task.title}</strong>
        <span>{memberName(props.members, props.task.primaryExecutorMemberId)} · {labelTaskStage[props.task.stage]} · {labelPriority[props.task.priority]}</span>
      </div>
      <div className="task-progress-bar">
        <span style={{ width: `${Math.max(0, Math.min(100, props.task.progressPercent ?? 0))}%` }} />
        <strong>{props.task.progressPercent ?? 0}%</strong>
      </div>
      {props.task.notes && <p>{props.task.notes}</p>}
      <div className="button-row">
        <button className="small-button" onClick={() => props.selectTask(props.task.id)}>详情</button>
        {props.task.status !== "completed" && props.task.status !== "split" && props.task.status !== "archived" && (
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
        value={props.task.status}
        disabled={!props.canEdit || (props.task.status === "pending_review" && !props.canReview)}
        onChange={(event) => props.updateStatus(props.task.id, event.target.value as TaskStatus)}
      >
        {statusColumns.map((column) => (
          <option key={column.status} value={column.status}>{column.title}</option>
        ))}
      </select>
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
