import { useEffect, useState } from "react";
import { Plus, Save, SlidersHorizontal, UserPlus } from "lucide-react";
import { defaultTaskStageForMode, nowIso, taskStageModeOptions } from "../appModel";
import { projectTaskStatusColumns } from "../projectTaskDisplay";
import {
  type ProjectTaskInput,
  type ProjectTaskFilters,
  type ProjectDetailModel,
} from "../projectDetail";
import type { Project, ProjectMember, ProjectMemberRole, Task, TaskStageMode, TaskStatus, Workspace } from "../types";
import { TaskDetailModal } from "./WorkspaceView";
import { ScheduleCalendarView } from "./ScheduleCalendarView";
import { AddProjectMemberModal } from "./projectDetail/AddProjectMemberModal";
import { ProjectAcceptedTasksPanel } from "./projectDetail/ProjectAcceptedTasksPanel";
import { ProjectMemberBindingPanel } from "./projectDetail/ProjectMemberBindingPanel";
import { ProjectOverviewTaskBoard } from "./projectDetail/ProjectOverviewTaskBoard";
import { ProjectTaskCreateDialog } from "./projectDetail/ProjectTaskCreateDialog";
import { ProjectTaskRow } from "./projectDetail/ProjectTaskRow";
export { MemberStatusView } from "./MemberStatusView";
export {
  stageTaskCardClassName,
  stageTaskSortRank,
  stageTaskStatePills,
  stageTaskStatusLabel,
} from "../projectTaskDisplay";

export type ProjectDetailTab = "overview" | "schedule" | "tasks" | "members" | "settings";

const statusColumns = projectTaskStatusColumns;

const createEmptyProjectTaskDraft = (taskStageMode: TaskStageMode = "software"): ProjectTaskInput => ({
  title: "",
  notes: "",
  tags: [],
  priority: "medium",
  severity: "medium",
  stage: defaultTaskStageForMode(taskStageMode),
  estimateHours: 1,
  collaboratorMemberIds: [],
  repeatRule: "none",
  repeatIntervalDays: 1,
  subtasks: [],
});

type ProjectSettingsDraft = {
  projectId: string;
  name: string;
  description: string;
  taskStageMode: TaskStageMode;
  workspaceId: string;
};

export function ProjectDetailView(props: {
  model?: ProjectDetailModel;
  filters: ProjectTaskFilters;
  setFilters: (filters: ProjectTaskFilters) => void;
  allProjects: Project[];
  allProjectMembers: ProjectMember[];
  availableWorkspaces: Workspace[];
  currentProjectMemberId?: string;
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
  bindAccessibleMemberToProject: (projectId: string, input: {
    accountId?: string;
    name: string;
    email?: string;
    workspaceId?: string;
    roles: ProjectMemberRole[];
  }) => void;
  inviteProjectMember: (input: { workspaceId?: string; projectId: string; email: string; roles: ProjectMemberRole[] }) => void;
  updateProjectMember: (member: ProjectMember) => void;
  canManageProjectMembers?: boolean;
  backToBoard: () => void;
  backToAdmin: () => void;
  openMemberSettings: () => void;
}) {
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateTaskDialog, setShowCreateTaskDialog] = useState(false);
  const [showAddMemberDialog, setShowAddMemberDialog] = useState(false);
  const [draft, setDraft] = useState<ProjectTaskInput>(createEmptyProjectTaskDraft);
  const [settingsDraft, setSettingsDraft] = useState<ProjectSettingsDraft | null>(null);
  const { filters, setFilters } = props;
  const model = props.model;

  useEffect(() => {
    if (!model) return;
    setSettingsDraft({
      projectId: model.project.id,
      name: model.project.name,
      description: model.project.description,
      taskStageMode: model.project.taskStageMode ?? "software",
      workspaceId: model.project.workspaceId ?? model.workspace?.id ?? "",
    });
  }, [model?.project.id, model?.project.updatedAt, model?.workspace?.id]);

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
    workspace,
    access,
    projectMembers,
    accessibleProjectMembers,
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
    accessibleMemberCount,
    memberOverviewStats,
  } = model;
  const projectStageMode = project.taskStageMode ?? "software";
  const isPrivateProject = (workspace?.type ?? "shared") === "private";
  const workspaceTagLabel = workspace
    ? `${isPrivateProject ? "私人工作区" : "协作工作区"} · ${workspace.name}`
    : "未归属工作区";
  const currentProjectWorkspaceId = project.workspaceId ?? workspace?.id;
  const editableProjectSettings = settingsDraft?.projectId === project.id ? settingsDraft : {
    projectId: project.id,
    name: project.name,
    description: project.description,
    taskStageMode: projectStageMode,
    workspaceId: currentProjectWorkspaceId ?? "",
  };
  const workspaceOptions = [
    ...props.availableWorkspaces,
    ...(workspace && !props.availableWorkspaces.some((item) => item.id === workspace.id) ? [workspace] : []),
  ].filter((item, index, items) =>
    items.findIndex((candidate) => candidate.id === item.id) === index &&
    ((item.type ?? "shared") !== "private" || item.id === currentProjectWorkspaceId),
  );
  const canManageProjectMembers = props.canManageProjectMembers ?? access.canReviewTasks;
  const canShowProjectMemberManagement = canManageProjectMembers && !isPrivateProject;
  const activeTab = !canShowProjectMemberManagement && props.activeTab === "members" ? "overview" : props.activeTab;
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
    setDraft(createEmptyProjectTaskDraft(projectStageMode));
    setShowCreateTaskDialog(false);
  };

  const openCreateTaskDialog = () => {
    setDraft(createEmptyProjectTaskDraft(projectStageMode));
    setShowCreateTaskDialog(true);
  };

  const updateStatus = (taskId: string, status: TaskStatus) => {
    const task = allProjectTasks.find((item) => item.id === taskId);
    props.updateTask(taskId, {
      status,
      completedAt: status === "completed" ? nowIso() : undefined,
      reviewSubmittedAt: status === "pending_review" ? nowIso() : undefined,
      reviewSubmittedByMemberId: status === "pending_review" && task ? props.currentProjectMemberId : undefined,
    });
  };
  const updateMemberRole = (member: typeof accessibleProjectMembers[number], role: ProjectMemberRole, checked: boolean) => {
    const currentRoles = member.projectMember?.roles ?? member.roles;
    const roles = checked ? Array.from(new Set([...currentRoles, role])) : currentRoles.filter((item) => item !== role);
    const nextRoles = roles.length ? roles : ["executor" as ProjectMemberRole];
    if (member.projectMember) {
      props.updateProjectMember({ ...member.projectMember, roles: nextRoles });
      return;
    }
    props.bindAccessibleMemberToProject(project.id, {
      accountId: member.workspaceMembership?.accountId,
      name: member.name,
      email: member.email,
      workspaceId: project.workspaceId ?? workspace?.id,
      roles: nextRoles,
    });
  };
  const updateSettingsDraft = (patch: Partial<Omit<ProjectSettingsDraft, "projectId">>) => {
    setSettingsDraft((value) => ({
      ...(value?.projectId === project.id ? value : editableProjectSettings),
      ...patch,
    }));
  };
  const saveProjectSettings = () => {
    if (!access.canReviewTasks) return;
    const nextName = editableProjectSettings.name.trim();
    if (!nextName) return;
    const nextWorkspaceId = editableProjectSettings.workspaceId || currentProjectWorkspaceId;
    if (nextWorkspaceId && nextWorkspaceId !== currentProjectWorkspaceId) {
      const targetWorkspace = workspaceOptions.find((item) => item.id === nextWorkspaceId);
      const confirmed = window.confirm(`确定将项目「${project.name}」移动到「${targetWorkspace?.name ?? "目标工作区"}」吗？项目下的任务和项目成员归属会一起更新。`);
      if (!confirmed) return;
    }
    props.updateProject({
      ...project,
      name: nextName,
      description: editableProjectSettings.description,
      taskStageMode: editableProjectSettings.taskStageMode,
      workspaceId: nextWorkspaceId,
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
            ["settings", "设置"],
            ["members", "项目成员管理"],
          ] as const).filter(([tab]) => canShowProjectMemberManagement || tab !== "members").map(([tab, label]) => (
            <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => props.setActiveTab(tab)}>
              {label}
            </button>
          ))}
        </div>
        <div className="project-detail-identity" aria-label={`当前项目 ${project.name}，所属${workspaceTagLabel}`}>
          <strong title={project.name}>{project.name}</strong>
          <span title={workspaceTagLabel}>{workspaceTagLabel}</span>
        </div>
        <div className="project-detail-stats">
          <Metric label="进度" value={`${board.projectProgress}%`} />
          <Metric label="任务" value={`${allProjectTasks.length}`} />
          <Metric label="成员" value={`${accessibleMemberCount}`} />
          <Metric label="待验收" value={`${taskCounts.pending_review}`} />
        </div>
      </section>

      {activeTab === "overview" && (
        <>
          <section className="band project-task-workspace project-overview-task-board">
            <div className="section-title">
              <div className="project-board-title">
                <span className="count-pill">{overviewTasks.length}</span>
                <h2>任务阶段总览</h2>
              </div>
              <button className="primary-button compact-button" disabled={!access.canEditTasks} onClick={openCreateTaskDialog}>
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
              taskStageMode={projectStageMode}
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

      {activeTab === "tasks" && (
        <section className="band project-task-workspace">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目任务</p>
              <h2>创建与任务列表</h2>
            </div>
            <div className="button-row">
              <button className="primary-button compact-button" disabled={!access.canEditTasks} onClick={openCreateTaskDialog}>
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

      {activeTab === "schedule" && (
        <section className="band project-schedule-panel">
          <ScheduleCalendarView
            tasks={allProjectTasks}
            members={projectMembers}
            activeTaskIds={activeProjectTaskIds}
            todayTaskIds={todayPlan?.committedTaskIds ?? []}
            taskStageMode={projectStageMode}
            embedded
            title={`${project.name}排期`}
            subtitle="按阶段查看当前项目任务的排期、负责人、今日任务和运行状态。"
            openTask={props.selectTask}
          />
        </section>
      )}

      {canShowProjectMemberManagement && activeTab === "members" && (
        <section className="band project-members-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目成员</p>
              <h2>项目成员管理</h2>
            </div>
            <button className="secondary-button" disabled={!canManageProjectMembers} onClick={() => setShowAddMemberDialog(true)}>
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
            accessibleMembers={accessibleProjectMembers}
            canManage={canManageProjectMembers}
            updateMemberRole={updateMemberRole}
            updateProjectMember={props.updateProjectMember}
          />
      {showAddMemberDialog && (
        <AddProjectMemberModal
          project={project}
          canManage={canManageProjectMembers}
          inviteMember={(input) => props.inviteProjectMember({
            workspaceId: project.workspaceId,
            projectId: project.id,
            email: input.email,
            roles: input.roles,
          })}
          onClose={() => setShowAddMemberDialog(false)}
        />
      )}
        </section>
      )}

      {activeTab === "settings" && (
        <section className="band project-settings-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">项目设置</p>
              <h2>项目资料</h2>
            </div>
          </div>
          <div className="settings-grid project-settings-form">
            <label>
              项目名称
              <input value={editableProjectSettings.name} disabled={!access.canReviewTasks} onChange={(event) => updateSettingsDraft({ name: event.target.value })} />
            </label>
            <label>
              项目类型
              <select
                value={editableProjectSettings.taskStageMode}
                disabled={!access.canReviewTasks}
                onChange={(event) => updateSettingsDraft({ taskStageMode: event.target.value as TaskStageMode })}
              >
                {taskStageModeOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
            <label>
              所属工作区
              <select
                value={editableProjectSettings.workspaceId}
                disabled={!access.canReviewTasks || workspaceOptions.length <= 1}
                onChange={(event) => updateSettingsDraft({ workspaceId: event.target.value })}
              >
                {workspaceOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {(item.type ?? "shared") === "private" ? "私人" : "协作"} · {item.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="project-settings-description">
              项目说明
              <textarea value={editableProjectSettings.description} disabled={!access.canReviewTasks} onChange={(event) => updateSettingsDraft({ description: event.target.value })} />
            </label>
          </div>
          <div className="project-settings-actions">
            <button className="primary-button" disabled={!access.canReviewTasks || !editableProjectSettings.name.trim()} onClick={saveProjectSettings}>
              <Save size={16} />
              保存项目资料
            </button>
          </div>
        </section>
      )}

      <TaskDetailModal
        task={props.selectedTask?.projectId === project.id ? props.selectedTask : undefined}
        projects={props.allProjects}
        projectMembers={props.allProjectMembers}
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
        taskStageMode={projectStageMode}
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
