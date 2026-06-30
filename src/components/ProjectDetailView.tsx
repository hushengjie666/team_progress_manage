import { useState } from "react";
import { Check, CheckCircle2, ChevronRight, Eye, Plus, Search, Settings, SlidersHorizontal, UserPlus, UserRoundPen, Users, X } from "lucide-react";
import { labelPriority, labelTaskStage, nowIso, taskStageOptions, today } from "../appModel";
import {
  projectTaskStatusColumns,
  stageTaskCardClassName,
  stageTaskSortRank,
  stageTaskStatePills,
  stageTaskStatusLabel,
} from "../projectTaskDisplay";
import {
  deriveProjectDetailModel,
  type ProjectTaskInput,
  type ProjectTaskFilters,
} from "../projectDetail";
import type { AppState, Project, ProjectMember, ProjectMemberRole, Task, TaskStatus, TeamMember } from "../types";
import { TaskDetailModal } from "./WorkspaceView";
import { ScheduleCalendarView } from "./ScheduleCalendarView";
import { ProjectTaskCreateDialog } from "./projectDetail/ProjectTaskCreateDialog";
export { MemberStatusView } from "./MemberStatusView";
export {
  stageTaskCardClassName,
  stageTaskSortRank,
  stageTaskStatePills,
  stageTaskStatusLabel,
} from "../projectTaskDisplay";

export type ProjectDetailTab = "overview" | "schedule" | "tasks" | "members" | "settings";

const statusColumns = projectTaskStatusColumns;

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
  const [filters, setFilters] = useState<ProjectTaskFilters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [addMemberRolesById, setAddMemberRolesById] = useState<Record<string, ProjectMemberRole[]>>({});
  const [draft, setDraft] = useState<ProjectTaskInput>(createEmptyProjectTaskDraft);
  const model = deriveProjectDetailModel(props.state, props.projectId, filters, today());

  if (!model) {
    return (
      <section className="band project-detail-shell">
        <p className="empty">项目不存在或已被删除。</p>
        <button className="secondary-button" onClick={props.backToBoard}>返回项目总览</button>
      </section>
    );
  }

  const {
    project,
    access,
    projectMembers,
    activeTeamMembers,
    addableTeamMembers,
    executors,
    allProjectTasks,
    overviewTasks,
    acceptedTasks,
    todayPlan,
    activeProjectTaskIds,
    filteredTasks,
    board,
    riskSections,
    riskTaskCount,
    taskCounts,
    memberOverviewStats,
  } = model;
  const signalSectionMeta = {
    assigned_not_started: { label: "未启动", description: "已分配但还没有开始记录。" },
    stalled: { label: "停滞", description: "任务超过预期但没有新的执行信号。" },
    blocked: { label: "阻塞", description: "进展说明或退回原因包含阻塞信息。" },
    pending_review: { label: "验收", description: "等待项目负责人确认结果。" },
    near_finish: { label: "临近", description: "预计完成时间即将到达。" },
    normal: { label: "正常", description: "当前没有明显风险信号。" },
  } as const;

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
  const addMemberRoles = (teamMemberId: string) => addMemberRolesById[teamMemberId] ?? ["executor"];
  const updateAddMemberRole = (teamMemberId: string, role: ProjectMemberRole, checked: boolean) => {
    setAddMemberRolesById((value) => {
      const current = value[teamMemberId] ?? ["executor"];
      const roles = checked ? Array.from(new Set([...current, role])) : current.filter((item) => item !== role);
      return { ...value, [teamMemberId]: roles.length ? roles : ["executor"] };
    });
  };
  const addTeamMemberToProject = (teamMemberId: string) => {
    props.bindTeamMemberToProject(project.id, teamMemberId, addMemberRoles(teamMemberId));
    setAddMemberRolesById((value) => {
      const next = { ...value };
      delete next[teamMemberId];
      return next;
    });
  };

  return (
    <div className="project-detail-layout">
      <section className="band project-detail-hero">
        <div className="segmented project-detail-tabs">
          {([
            ["overview", "概览"],
            ["schedule", "排期日历"],
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
                <span className="count-pill">{overviewTasks.length}</span>
                <h2>任务阶段总览</h2>
              </div>
              <button className="primary-button compact-button" disabled={!access.canEditTasks} onClick={() => setShowCreateTaskDialog(true)}>
                <Plus size={16} />
                添加任务
              </button>
            </div>
            <ProjectOverviewTaskBoard
              tasks={overviewTasks}
              members={projectMembers}
              todayTaskIds={todayPlan?.committedTaskIds ?? []}
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
              <span className="count-pill">{riskTaskCount}</span>
            </div>

            <div className="progress-signal-summary">
              {board.sections.filter((section) => section.kind !== "pending_review" && section.kind !== "normal").map((section) => (
                <div className={section.tasks.length > 0 ? "signal-summary-chip attention" : "signal-summary-chip"} key={section.kind}>
                  <span>{signalSectionMeta[section.kind].label}</span>
                  <strong>{section.tasks.length}</strong>
                </div>
              ))}
            </div>

            <div className="progress-signal-layout">
              <div className="signal-attention-panel">
                <div className="signal-panel-heading">
                  <div>
                    <strong>需要关注</strong>
                    <span>按风险原因归类，优先处理这里的任务。</span>
                  </div>
                  <span>{riskTaskCount}</span>
                </div>
                {riskSections.length === 0 && <p className="empty">当前没有需要特别处理的任务。</p>}
                <div className="signal-task-list">
                  {riskSections.flatMap((section) =>
                    section.tasks.map((task) => (
                      <article className={`signal-task-row signal-task-${section.kind}`} key={`${section.kind}-${task.taskId}`}>
                        <span className="signal-kind-badge">{section.title}</span>
                        <div>
                          <strong>{task.title}</strong>
                          <span>{task.executorName ?? "未分配执行者"} · 进度 {task.progressPercent}%</span>
                          <p>{task.detail}</p>
                        </div>
                        <button className="small-button" onClick={() => props.selectTask(task.taskId)}>查看</button>
                      </article>
                    )),
                  )}
                </div>
              </div>
            </div>
          </section>
          <ProjectAcceptedTasksPanel
            tasks={acceptedTasks}
            members={projectMembers}
            selectTask={props.selectTask}
          />
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
              <span>执行人</span>
              <span>状态</span>
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

      {props.activeTab === "schedule" && (
        <section className="band project-schedule-panel">
          <ScheduleCalendarView
            state={props.state}
            tasks={allProjectTasks}
            members={projectMembers}
            embedded
            title={`${project.name}排期`}
            subtitle="按阶段查看当前项目任务的排期、负责人、今日任务和运行状态。"
            openTask={props.selectTask}
          />
        </section>
      )}

      {props.activeTab === "members" && (
        <section className="band project-members-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目成员</p>
              <h2>成员数量总览</h2>
            </div>
            <button className="secondary-button" disabled={!access.canReviewTasks} onClick={() => setShowAddMemberDialog(true)}>
              <UserPlus size={16} />
              添加成员
            </button>
          </div>
          <div className="project-member-summary-grid">
            {memberOverviewStats.map((item) => (
              <article className={item.label === "待验收" && item.value > 0 ? "project-member-summary-card attention" : "project-member-summary-card"} key={item.label}>
                <span>{item.label}</span>
                <strong>{item.value}</strong>
                <small>{item.helper}</small>
              </article>
            ))}
          </div>
          <ProjectMemberBindingPanel
            project={project}
            teamMembers={activeTeamMembers}
            projectMembers={props.state.projectMembers}
            canManage={access.canReviewTasks}
            updateMemberRole={updateMemberRole}
            updateProjectMember={props.updateProjectMember}
          />
          {showAddMemberDialog && (
            <AddProjectMemberModal
              project={project}
              addableTeamMembers={addableTeamMembers}
              canManage={access.canReviewTasks}
              rolesForMember={addMemberRoles}
              updateRole={updateAddMemberRole}
              addMember={addTeamMemberToProject}
              openMemberSettings={props.openMemberSettings}
              onClose={() => setShowAddMemberDialog(false)}
            />
          )}
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

function formatAcceptedAt(iso?: string) {
  if (!iso) return "未记录验收时间";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "验收时间异常";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ProjectAcceptedTasksPanel(props: {
  tasks: Task[];
  members: ProjectMember[];
  selectTask: (taskId: string) => void;
}) {
  const membersById = new Map(props.members.map((member) => [member.id, member]));

  return (
    <section className="band project-accepted-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">验收归档</p>
          <h2>验收通过</h2>
        </div>
        <span className="count-pill">{props.tasks.length}</span>
      </div>
      {props.tasks.length === 0 && <p className="empty">当前项目还没有验收通过的任务。</p>}
      {props.tasks.length > 0 && (
        <div className="project-accepted-list">
          {props.tasks.map((task) => {
            const executorName = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId)?.name ?? "已分配" : "未分配";
            return (
              <button className="project-accepted-card" key={task.id} onClick={() => props.selectTask(task.id)} type="button">
                <span className="accepted-icon">
                  <CheckCircle2 size={18} />
                </span>
                <div className="project-accepted-main">
                  <strong>{task.title}</strong>
                  <span>{executorName} · {labelTaskStage[task.stage]} · {labelPriority[task.priority]} · {task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
                </div>
                <div className="project-accepted-time">
                  <span>验收时间</span>
                  <strong>{formatAcceptedAt(task.reviewAcceptedAt)}</strong>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </section>
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

function ProjectOverviewTaskBoard(props: {
  tasks: Task[];
  members: ProjectMember[];
  todayTaskIds: string[];
  selectTask: (taskId: string) => void;
  activeTaskIds: string[];
}) {
  const activeTaskIdSet = new Set(props.activeTaskIds);
  const todayTaskIdSet = new Set(props.todayTaskIds);
  const membersById = new Map(props.members.map((member) => [member.id, member]));
  const statusOrder: Record<TaskStatus, number> = {
    in_progress: 0,
    pending_review: 1,
    committed: 2,
    pool: 3,
    completed: 4,
    split: 5,
    archived: 6,
  };
  const sortedTasks = (tasks: Task[]) => [...tasks].sort((left, right) => {
    const leftRank = stageTaskSortRank(left.status, activeTaskIdSet.has(left.id), todayTaskIdSet.has(left.id));
    const rightRank = stageTaskSortRank(right.status, activeTaskIdSet.has(right.id), todayTaskIdSet.has(right.id));
    if (leftRank !== rightRank) return leftRank - rightRank;
    const statusDelta = statusOrder[left.status] - statusOrder[right.status];
    if (statusDelta !== 0) return statusDelta;
    return left.sortOrder - right.sortOrder;
  });

  const renderStageTask = (task: Task) => {
    const isActive = activeTaskIdSet.has(task.id);
    const isTodayTask = todayTaskIdSet.has(task.id);
    const statusLabel = stageTaskStatusLabel(task.status);
    const statePills = stageTaskStatePills(task.status, isActive);
    const executorName = task.primaryExecutorMemberId ? membersById.get(task.primaryExecutorMemberId)?.name ?? "已分配" : undefined;
    return (
      <button
        className={stageTaskCardClassName(task.status, isActive, isTodayTask)}
        key={task.id}
        onClick={() => props.selectTask(task.id)}
        type="button"
      >
        <div className="project-stage-task-main">
          <strong>{task.title}</strong>
          <span>{statusLabel} · {labelPriority[task.priority]} · {task.progressPercent ?? 0}% · {task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
        </div>
        {isActive && (
          <span className="working-indicator" aria-label="当前任务执行中">
            <UserRoundPen size={32} />
          </span>
        )}
        <div className="project-stage-task-tags">
          {executorName ? <span className="task-info-pill assignee">{executorName}</span> : <span className="task-info-pill muted">未分配</span>}
          {isTodayTask && <span className="task-info-pill today">今日</span>}
          {statePills.map((pill) => (
            <span className={`task-info-pill ${pill.className}`} key={pill.className}>{pill.label}</span>
          ))}
          <Eye size={14} />
        </div>
      </button>
    );
  };

  return (
    <section className="project-stage-overview">
      {taskStageOptions.map((stage) => {
        const stageTasks = sortedTasks(props.tasks.filter((task) => task.stage === stage.value));
        return (
          <div className="project-stage-row" key={stage.value}>
            <div className="project-stage-label">
              <strong>{stage.label}</strong>
              <span>{stageTasks.length}</span>
            </div>
            <div className="project-stage-task-list">
              {stageTasks.length === 0 && <p className="project-stage-empty">暂无任务</p>}
              {stageTasks.map(renderStageTask)}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ProjectMemberBindingPanel({
  project,
  teamMembers,
  projectMembers,
  canManage,
  updateMemberRole,
  updateProjectMember,
}: {
  project: Project;
  teamMembers: TeamMember[];
  projectMembers: ProjectMember[];
  canManage: boolean;
  updateMemberRole: (member: ProjectMember, role: ProjectMemberRole, checked: boolean) => void;
  updateProjectMember: (member: ProjectMember) => void;
}) {
  const bindings = projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled");
  const teamMemberById = new Map(teamMembers.map((member) => [member.id, member]));

  return (
    <section className="project-binding-panel inline-project-binding">
      <div className="member-section-title">
        <strong>项目成员管理</strong>
        <span>这里只显示已加入当前项目的成员，角色在这里维护。</span>
      </div>
      <div className="project-binding-list">
        {bindings.map((binding) => {
          const teamMember = binding.teamMemberId ? teamMemberById.get(binding.teamMemberId) : undefined;
          return (
            <article className="project-binding-row bound" key={binding.id}>
              <div>
                <strong>{teamMember?.name ?? binding.name}</strong>
                <span>{teamMember?.email ?? binding.email ?? "未填写登录信息"}</span>
              </div>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={binding.roles.includes("project_owner")}
                  disabled={!canManage}
                  onChange={(event) => updateMemberRole(binding, "project_owner", event.target.checked)}
                />
                项目负责人
              </label>
              <label className="inline-toggle">
                <input
                  type="checkbox"
                  checked={binding.roles.includes("executor")}
                  disabled={!canManage}
                  onChange={(event) => updateMemberRole(binding, "executor", event.target.checked)}
                />
                执行者
              </label>
              <button className="secondary-button" disabled={!canManage} onClick={() => updateProjectMember({ ...binding, status: "disabled" })}>
                解除绑定
              </button>
            </article>
          );
        })}
        {!bindings.length && <p className="empty">当前项目还没有成员，请点击“添加成员”从成员库加入。</p>}
      </div>
    </section>
  );
}

function AddProjectMemberModal(props: {
  project: Project;
  addableTeamMembers: TeamMember[];
  canManage: boolean;
  rolesForMember: (teamMemberId: string) => ProjectMemberRole[];
  updateRole: (teamMemberId: string, role: ProjectMemberRole, checked: boolean) => void;
  addMember: (teamMemberId: string) => void;
  openMemberSettings: () => void;
  onClose: () => void;
}) {
  const [memberQuery, setMemberQuery] = useState("");
  const normalizedQuery = memberQuery.trim().toLowerCase();
  const filteredTeamMembers = normalizedQuery
    ? props.addableTeamMembers.filter((teamMember) =>
        [teamMember.name, teamMember.email, teamMember.accountId].filter(Boolean).join(" ").toLowerCase().includes(normalizedQuery),
      )
    : props.addableTeamMembers;

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={props.onClose}>
      <section
        className={`modal-panel add-project-member-modal${props.addableTeamMembers.length ? "" : " no-search"}`}
        role="dialog"
        aria-modal="true"
        aria-label="添加项目成员"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-heading">
          <div>
            <p className="eyebrow">PROJECT MEMBER</p>
            <h2>添加成员</h2>
            <span>从成员库选择成员加入「{props.project.name}」，并设置项目内角色。</span>
          </div>
          <button className="icon-button" onClick={props.onClose} aria-label="关闭">
            <X size={18} />
          </button>
        </div>
        {props.addableTeamMembers.length > 0 && (
          <div className="add-project-member-tools">
            <label className="add-project-member-search">
              <Search size={17} />
              <input
                autoFocus
                value={memberQuery}
                onChange={(event) => setMemberQuery(event.target.value)}
                placeholder="搜索姓名、邮箱或账号"
                aria-label="搜索成员"
              />
              {memberQuery && (
                <button className="icon-button small" type="button" onClick={() => setMemberQuery("")} aria-label="清空搜索">
                  <X size={15} />
                </button>
              )}
            </label>
            <span>{filteredTeamMembers.length} / {props.addableTeamMembers.length} 可加入</span>
          </div>
        )}
        <div className="add-project-member-list">
          {filteredTeamMembers.map((teamMember) => {
            const roles = props.rolesForMember(teamMember.id);
            return (
              <article className="add-project-member-row" key={teamMember.id}>
                <div className="add-project-member-profile">
                  <strong>{teamMember.name}</strong>
                  <span>{teamMember.email ?? "未填写登录信息"}</span>
                </div>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={roles.includes("project_owner")}
                    disabled={!props.canManage}
                    onChange={(event) => props.updateRole(teamMember.id, "project_owner", event.target.checked)}
                  />
                  项目负责人
                </label>
                <label className="inline-toggle">
                  <input
                    type="checkbox"
                    checked={roles.includes("executor")}
                    disabled={!props.canManage}
                    onChange={(event) => props.updateRole(teamMember.id, "executor", event.target.checked)}
                  />
                  执行者
                </label>
                <button className="primary-button" disabled={!props.canManage} onClick={() => props.addMember(teamMember.id)}>
                  加入项目
                </button>
              </article>
            );
          })}
          {props.addableTeamMembers.length > 0 && !filteredTeamMembers.length && (
            <div className="empty add-project-member-empty">
              <strong>没有匹配成员</strong>
              <span>换个姓名、邮箱或账号关键词再试。</span>
              <button className="secondary-button" onClick={() => setMemberQuery("")}>
                清空搜索
              </button>
            </div>
          )}
          {!props.addableTeamMembers.length && (
            <div className="empty add-project-member-empty">
              <strong>没有可加入的成员</strong>
              <span>成员库里的成员都已经加入当前项目，或者成员库暂时为空。</span>
              <button className="secondary-button" onClick={props.openMemberSettings}>
                <Users size={15} />
                打开成员库
              </button>
            </div>
          )}
        </div>
      </section>
    </div>
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
        {statusColumns.map((column) => (
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
