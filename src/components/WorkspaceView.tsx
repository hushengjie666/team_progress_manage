import type React from "react";
import { useEffect, useState } from "react";
import { Activity, AlarmClock, ArrowDown, ArrowUp, Check, ChevronRight, PanelRight, Play, Plus, SlidersHorizontal, Sparkles, Split, Square, Target, Trash2, X } from "lucide-react";
import { coachSteps, estimateDeltaLabel, planPressure, taskSuggestions, unresolvedInterruptions } from "../domain";
import { formatDateTimeLocal, labelPriority, labelTaskStage, nowIso, parseDateTimeLocal, taskStageOptions, today, type TaskDraft, type TaskFilters, type TaskSort } from "../appModel";
import {
  buildMyProjectTaskCards,
  buildProjectOverviewCards,
  taskAssignedToMemberIdentity,
  projectMemberIdentityIds,
  type MyProjectTaskCard,
  type ProjectOverviewCard,
} from "../projectOverview";
import { uid } from "../seed";
import type { AppState, CoachStepId, DailyPlan, Priority, ProjectMember, RepeatRule, Severity, Subtask, Task, TaskStage, TaskStatus } from "../types";

export function WorkspaceView(props: {
  mode: "board" | "workbench";
  state: AppState;
  draft: TaskDraft;
  setDraft: (draft: TaskDraft) => void;
  addTask: (projectId?: string) => void;
  poolTasks: Task[];
  committedTasks: Task[];
  todayPlan: DailyPlan;
  selectedTask?: Task;
  taskFilters: TaskFilters;
  setTaskFilters: (filters: TaskFilters) => void;
  totalCommittedEstimate: number;
  commitTask: (taskId: string) => void;
  removeCommittedTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
  updatePlanCapacity: (capacity: number) => void;
  acknowledgeOverload: () => void;
  generateTodayPlan: () => void;
  dismissCoachStep: (stepId: CoachStepId) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  openProjectSettings: () => void;
  openProjectDetail: (projectId: string) => void;
  resolveInterruption: (interruptionId: string) => void;
  convertInterruptionToTask: (interruptionId: string) => void;
}) {
  const {
    state,
    poolTasks,
    committedTasks,
    todayPlan,
    selectedTask,
    taskFilters,
    setTaskFilters,
    totalCommittedEstimate,
    commitTask,
    removeCommittedTask,
    completeTask,
    deleteTask,
    selectTask,
    updateTask,
    updateTaskAssignment,
    updateTaskProgress,
    acceptTask,
    returnTaskForReview,
    moveCommittedTask,
    updatePlanCapacity,
    acknowledgeOverload,
    generateTodayPlan,
    dismissCoachStep,
    splitTask,
    beginFocus,
    resolveInterruption,
    convertInterruptionToTask,
  } = props;

  const remainingEstimate = Math.max(0, totalCommittedEstimate - todayPlan.completedPomodoros);
  const overload = totalCommittedEstimate > todayPlan.capacityPomodoros;
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  const inbox = unresolvedInterruptions(state).slice(0, 6);
  const pressure = planPressure(state, todayPlan);
  const suggestions = taskSuggestions(state, todayPlan.date, 5);
  const guideSteps = coachSteps(state, todayPlan.date).filter((step) => !(state.settings.dismissedCoachSteps ?? []).includes(step.id));
  const nextGuideStep = guideSteps.find((step) => !step.completed);
  const currentMember = state.projectMembers.find((member) => member.id === state.currentMemberId) ?? state.projectMembers[0];
  const myProjectTaskCards = buildMyProjectTaskCards(state, currentMember);
  const availableWorkbenchProjectIds = myProjectTaskCards.map((card) => card.projectId);
  const [selectedWorkbenchProjectIds, setSelectedWorkbenchProjectIds] = useState<string[]>([]);
  const effectiveWorkbenchProjectIds = selectedWorkbenchProjectIds.length > 0
    ? selectedWorkbenchProjectIds
    : availableWorkbenchProjectIds;
  const selectedProjectIdSet = new Set(effectiveWorkbenchProjectIds);
  const memberIdentityIds = projectMemberIdentityIds(state, currentMember);
  const committedWorkbenchTasks = committedTasks.filter(
    (task) =>
      selectedProjectIdSet.has(task.projectId) &&
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived" &&
      taskAssignedToMemberIdentity(task, memberIdentityIds),
  );
  const poolWorkbenchTasks = poolTasks.filter(
    (task) =>
      selectedProjectIdSet.has(task.projectId) &&
      task.status !== "completed" &&
      task.status !== "split" &&
      task.status !== "archived" &&
      taskAssignedToMemberIdentity(task, memberIdentityIds),
  );
  const projectOverviewCards = buildProjectOverviewCards(state);
  const [showFilters, setShowFilters] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  useEffect(() => {
    setSelectedWorkbenchProjectIds([]);
  }, [currentMember?.id]);
  useEffect(() => {
    setSelectedWorkbenchProjectIds((current) => {
      const available = new Set(availableWorkbenchProjectIds);
      const next = current.filter((projectId) => available.has(projectId));
      return next.length === current.length ? current : next;
    });
  }, [availableWorkbenchProjectIds.join("|")]);
  const toggleWorkbenchProject = (projectId: string) => {
    setSelectedWorkbenchProjectIds((current) => {
      return current.includes(projectId)
        ? current.filter((item) => item !== projectId)
        : [...current, projectId];
    });
  };
  const workbenchPanel = (
    <MyProjectTaskFilterPanel
      cards={myProjectTaskCards}
      selectedProjectIds={selectedWorkbenchProjectIds}
      toggleProject={toggleWorkbenchProject}
    />
  );

  if (props.mode === "board") {
    return (
      <div className="content-grid workspace-grid project-overview-grid">
        <ProjectOverviewCardsPanel
          cards={projectOverviewCards}
          openProjectDetail={props.openProjectDetail}
          openProjectSettings={props.openProjectSettings}
        />
      </div>
    );
  }

  return (
    <div className="content-grid workspace-grid">
      {workbenchPanel}

      {props.mode === "workbench" && (
        <>
      {overload && !todayPlan.overloadAcknowledged && (
        <section className="band warning-line">
          工作队列超出当前容量 {totalCommittedEstimate - todayPlan.capacityPomodoros} 个番茄。
          <button className="link-button" onClick={acknowledgeOverload}>
            我已确认
          </button>
        </section>
      )}

      {showGuidance && <section className="band coach-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Today Coach</p>
            <h2>{nextGuideStep ? "下一步很明确" : "今日闭环已跑起来"}</h2>
          </div>
          <Sparkles size={20} />
        </div>
        <div className="coach-steps">
          {guideSteps.map((step) => (
            <article className={step.completed ? "coach-step done" : "coach-step"} key={step.id}>
              <span>{step.completed ? <Check size={15} /> : <Target size={15} />}</span>
              <div>
                <strong>{step.title}</strong>
                <p>{step.detail}</p>
              </div>
              {!step.completed && (
                <button className="link-button" onClick={() => dismissCoachStep(step.id)}>
                  暂时隐藏
                </button>
              )}
            </article>
          ))}
        </div>
        <p className="muted">目标：{state.onboarding.desiredHabit}</p>
      </section>}

      {showGuidance && <section className={`band plan-assistant pressure-${pressure.level}`}>
        <div className="section-title">
          <div>
            <p className="eyebrow">Personal Planning</p>
            <h2>个人工作队列助手</h2>
          </div>
          <Target size={20} />
        </div>
        <div className="pressure-card">
          <strong>{pressure.label}</strong>
          <span>{pressure.detail}</span>
        </div>
        <div className="plan-actions">
          <button className="primary-button" onClick={generateTodayPlan}>
            <Sparkles size={16} />
            一键生成今日计划
          </button>
          <span>工作队列 {pressure.totalEstimate} / 容量 {todayPlan.capacityPomodoros}，剩余 {pressure.remainingEstimate}</span>
        </div>
        <div className="suggestion-list">
          {suggestions.slice(0, 3).map((suggestion) => {
            const task = state.tasks.find((item) => item.id === suggestion.taskId);
            if (!task) return null;
            return (
              <article className="suggestion-item" key={suggestion.taskId}>
                <div>
                  <strong>{task.title}</strong>
                  <span>{suggestion.reason}</span>
                </div>
                {suggestion.action === "split" ? (
                  <button className="small-button" onClick={() => splitTask(task.id)}>
                    拆分
                  </button>
                ) : (
                  <button className="small-button" onClick={() => commitTask(task.id)} disabled={suggestion.action === "defer"}>
                    加入今日
                  </button>
                )}
              </article>
            );
          })}
          {suggestions.length === 0 && <p className="empty">任务池没有可推荐任务。</p>}
        </div>
      </section>}

      <section className={showFilters ? "band filter-panel" : "filter-panel filter-inline"}>
        {showFilters ? <div className="section-title">
          <div>
            <p className="eyebrow">Filter</p>
            <h2>{showFilters ? "筛选与排序" : "任务筛选"}</h2>
          </div>
          <button className="icon-button small" title={showFilters ? "收起筛选" : "展开筛选"} onClick={() => setShowFilters((value) => !value)}>
            <SlidersHorizontal size={17} />
          </button>
        </div> : (
          <div className="filter-inline-row">
            <span>工作队列 {committedWorkbenchTasks.length} · 任务池 {poolWorkbenchTasks.length}</span>
            <button className="secondary-button" onClick={() => setShowFilters(true)}>
              <SlidersHorizontal size={16} />
              筛选
            </button>
          </div>
        )}
        {showFilters && <div className="filter-grid">
          <label>
            搜索
            <input
              value={taskFilters.query}
              onChange={(event) => setTaskFilters({ ...taskFilters, query: event.target.value })}
              placeholder="标题、备注、项目、标签"
            />
          </label>
          <label>
            项目
            <select value={taskFilters.project} onChange={(event) => setTaskFilters({ ...taskFilters, project: event.target.value })}>
              <option value="all">全部项目</option>
              {projects.map((project) => (
                <option value={project} key={project}>
                  {project}
                </option>
              ))}
            </select>
          </label>
          <label>
            标签
            <select value={taskFilters.tag} onChange={(event) => setTaskFilters({ ...taskFilters, tag: event.target.value })}>
              <option value="all">全部标签</option>
              {tags.map((tag) => (
                <option value={tag} key={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </label>
          <label>
            优先级
            <select
              value={taskFilters.priority}
              onChange={(event) => setTaskFilters({ ...taskFilters, priority: event.target.value as TaskFilters["priority"] })}
            >
              <option value="all">全部</option>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label>
            排序
            <select value={taskFilters.sort} onChange={(event) => setTaskFilters({ ...taskFilters, sort: event.target.value as TaskSort })}>
              <option value="manual">手动顺序</option>
              <option value="dueAt">到期日</option>
              <option value="priority">优先级</option>
              <option value="estimate">估算番茄</option>
            </select>
          </label>
        </div>}
      </section>

      <TaskColumn
        title="活动清单"
        eyebrow="待安排任务池"
        tasks={poolWorkbenchTasks}
        empty={selectedWorkbenchProjectIds.length > 0 ? "所选项目里暂无待安排任务。" : "暂无待安排任务。"}
        actionLabel="加入队列"
        actionIcon={<ChevronRight size={15} />}
        onAction={commitTask}
        onDelete={deleteTask}
        onSelect={selectTask}
        onSplit={splitTask}
        activeTaskId={state.activeTimer?.taskId}
      />

      <TaskColumn
        title="工作队列"
        eyebrow="今日准备执行"
        tasks={committedWorkbenchTasks}
        empty={selectedWorkbenchProjectIds.length > 0 ? "所选项目里暂无今日准备执行的任务。" : "暂无今日准备执行的任务。"}
        actionLabel="开始"
        actionIcon={<Play size={15} />}
        onAction={beginFocus}
        onRemove={removeCommittedTask}
        onComplete={completeTask}
        onSelect={selectTask}
        onSplit={splitTask}
        onMove={moveCommittedTask}
        activeTaskId={state.activeTimer?.taskId}
      />
        </>
      )}

      <TaskDetailModal
        task={selectedTask}
        projects={state.projects}
        projectMembers={state.projectMembers}
        updateTask={updateTask}
        updateTaskAssignment={updateTaskAssignment}
        updateTaskProgress={updateTaskProgress}
        acceptTask={acceptTask}
        returnTaskForReview={returnTaskForReview}
        close={() => selectTask(null)}
        splitTask={splitTask}
      />

      {props.mode === "workbench" && (
        <>
          {showGuidance && inbox.length > 0 && <section className="band inbox-panel">
            <div className="section-title">
              <div>
                <p className="eyebrow">Inbox</p>
                <h2>中断收件箱</h2>
              </div>
              <Activity size={20} />
            </div>
            {inbox.map((item) => (
              <article className="inbox-item" key={item.id}>
                <div>
                  <strong>{item.note}</strong>
                  <span>{item.type === "internal" ? "内部中断" : "外部中断"} · {new Date(item.createdAt).toLocaleTimeString()}</span>
                </div>
                <div className="button-row">
                  <button className="small-button" onClick={() => convertInterruptionToTask(item.id)}>转任务</button>
                  <button className="small-button" onClick={() => resolveInterruption(item.id)}>已处理</button>
                </div>
              </article>
            ))}
          </section>}
        </>
      )}
    </div>
  );
}

const projectStatusLabels: Record<TaskStatus, string> = {
  pool: "任务池",
  committed: "已安排",
  in_progress: "进行中",
  pending_review: "待验收",
  completed: "已完成",
  split: "已拆分",
  archived: "已归档",
};

const projectStatusOrder: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];

function ProjectOverviewCardsPanel(props: {
  cards: ProjectOverviewCard[];
  openProjectDetail: (projectId: string) => void;
  openProjectSettings: () => void;
}) {
  return (
    <section className="project-card-board" aria-label="项目卡片总览">
      {props.cards.length === 0 && (
        <div className="band project-overview-empty">
          <p className="eyebrow">项目总览</p>
          <h2>还没有项目</h2>
          <p className="muted">先到管理中心创建项目，再回到这里查看项目运营卡片。</p>
          <button className="primary-button" onClick={props.openProjectSettings}>创建项目</button>
        </div>
      )}
      {props.cards.map((card) => (
        <ProjectOverviewCardItem
          card={card}
          key={card.projectId}
          openProjectDetail={props.openProjectDetail}
          openProjectSettings={props.openProjectSettings}
        />
      ))}
    </section>
  );
}

function ProjectOverviewCardItem(props: {
  card: ProjectOverviewCard;
  openProjectDetail: (projectId: string) => void;
  openProjectSettings: () => void;
}) {
  const { card } = props;
  const hasRisk = card.riskCount > 0;
  const hasPendingReview = card.pendingReviewCount > 0;
  const activeStatuses = projectStatusOrder.filter((status) => card.statusCounts[status] > 0);

  return (
    <article className={hasRisk || hasPendingReview ? "project-overview-card attention" : "project-overview-card"}>
      <div className="project-overview-card-header">
        <div>
          <h2>{card.name}</h2>
          <p>{card.description || "这个项目还没有说明。"}</p>
        </div>
        <div className="project-overview-progress-inline" aria-label={`项目进度 ${card.progressPercent}%`}>
          <strong>{card.progressPercent}%</strong>
          <span>进度</span>
        </div>
      </div>

      <div className="project-overview-meter">
        <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
      </div>

      <div className="project-overview-metrics">
        <div>
          <span>任务</span>
          <strong>{card.taskCount}</strong>
        </div>
        <div>
          <span>成员</span>
          <strong>{card.memberCount}</strong>
        </div>
        <div className={card.riskCount > 0 ? "metric-danger metric-strong" : ""}>
          <span>风险</span>
          <strong>{card.riskCount}</strong>
        </div>
        <div className={card.pendingReviewCount > 0 ? "metric-warning metric-strong" : ""}>
          <span>待验收</span>
          <strong>{card.pendingReviewCount}</strong>
        </div>
      </div>

      <div className="project-status-strip">
        {(activeStatuses.length > 0 ? activeStatuses : ["pool" as TaskStatus]).map((status) => (
          <div className={`project-status-pill status-${status}`} key={status}>
            <span>{projectStatusLabels[status]}</span>
            <strong>{card.statusCounts[status]}</strong>
          </div>
        ))}
      </div>

      <div className="project-overview-signal">
        <span className={card.assignedNotStartedCount > 0 ? "signal-warning" : ""}>
          未开始 {card.assignedNotStartedCount}
        </span>
        <span className={card.activeSessionCount > 0 ? "signal-live" : ""}>
          工作会话 {card.activeSessionCount}
        </span>
      </div>

      <div className="project-overview-actions">
        <button className="primary-button" onClick={() => props.openProjectDetail(card.projectId)}>
          进入项目
          <ChevronRight size={16} />
        </button>
        <button className="secondary-button" onClick={props.openProjectSettings}>管理成员</button>
      </div>
    </article>
  );
}

function MyProjectTaskFilterPanel(props: {
  cards: MyProjectTaskCard[];
  selectedProjectIds: string[];
  toggleProject: (projectId: string) => void;
}) {
  const selectedSet = new Set(props.selectedProjectIds);
  const hasActiveFilter = props.selectedProjectIds.length > 0;

  return (
    <section className="band personal-workbench my-project-task-panel">
      <div className="my-project-card-grid">
        {props.cards.length === 0 && <p className="empty">当前成员还没有绑定项目。</p>}
        {props.cards.map((card) => {
          const selected = selectedSet.has(card.projectId);
          const selectionLabel = selected ? "筛选中" : hasActiveFilter ? "未筛选" : "默认全部";
          return (
            <button
              className={selected ? "my-project-task-card selected" : "my-project-task-card"}
              key={card.projectId}
              onClick={() => props.toggleProject(card.projectId)}
              type="button"
              aria-pressed={selected}
            >
              <div className="my-project-card-main">
                <div>
                  <p className="eyebrow">{selectionLabel}</p>
                  <h2>{card.name}</h2>
                </div>
                <div className="my-project-progress" aria-label={`项目进度 ${card.progressPercent}%`}>
                  <strong>{card.progressPercent}%</strong>
                </div>
              </div>
              <div className="my-project-mini-meter">
                <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
              </div>
              <div className="my-project-mini-metrics">
                <span>任务 {card.myTaskCount}</span>
                <span>进行中 {card.inProgressCount}</span>
                <span>待验收 {card.pendingReviewCount}</span>
                <span>池 {card.poolCount}</span>
                <span>安排 {card.committedCount}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function TaskColumn(props: {
  title: string;
  eyebrow: string;
  tasks: Task[];
  empty: string;
  actionLabel: string;
  actionIcon: React.ReactNode;
  onAction: (taskId: string) => void;
  onDelete?: (taskId: string) => void;
  onRemove?: (taskId: string) => void;
  onComplete?: (taskId: string) => void;
  onSelect?: (taskId: string) => void;
  onSplit?: (taskId: string) => void;
  onMove?: (taskId: string, direction: -1 | 1) => void;
  activeTaskId?: string;
}) {
  return (
    <section className="band task-column">
      <div className="section-title">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <h2>{props.title}</h2>
        </div>
        <span className="count-pill">{props.tasks.length}</span>
      </div>
      <div className="task-list">
        {props.tasks.length === 0 && <p className="empty">{props.empty}</p>}
        {props.tasks.map((task) => {
          const isActiveTask = props.activeTaskId === task.id;
          const canSubmitReview = task.status === "committed" || task.status === "in_progress";
          return (
          <article
            className={[
              "task-item",
              task.estimatePomodoros > 7 ? "warning-edge" : "",
              isActiveTask ? "active-edge running-task" : "",
            ].filter(Boolean).join(" ")}
            key={task.id}
          >
            <div>
              <div className="task-title-row">
                <strong>{task.title}</strong>
                <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
                {isActiveTask && <span className="running-pill"><Activity size={13} />正在执行</span>}
              </div>
              {task.notes && <p>{task.notes}</p>}
              <TaskProgressBar percent={task.progressPercent ?? 0} />
              <PomodoroProgress actual={task.actualPomodoros} estimate={task.estimatePomodoros} />
              <div className="task-meta">
                <span>{task.project}</span>
                <span>{labelTaskStage[task.stage]}</span>
                {task.dueAt && <span>到期 {new Date(task.dueAt).toLocaleDateString()}</span>}
                {task.severity === "very_high" && <span>高严重度</span>}
              </div>
              {task.tags.length > 0 && <div className="chip-row compact">
                {task.tags.slice(0, 2).map((tag) => (
                  <span className="chip" key={tag}>
                    {tag}
                  </span>
                ))}
                {task.tags.length > 2 && <span className="chip">+{task.tags.length - 2}</span>}
              </div>}
            </div>
            <div className="task-actions">
              {props.onMove && (
                <>
                  <button className="icon-button small" title="上移" onClick={() => props.onMove?.(task.id, -1)}>
                    <ArrowUp size={15} />
                  </button>
                  <button className="icon-button small" title="下移" onClick={() => props.onMove?.(task.id, 1)}>
                    <ArrowDown size={15} />
                  </button>
                </>
              )}
              {props.onSelect && (
                <button className="icon-button small" title="任务详情" onClick={() => props.onSelect?.(task.id)}>
                  <PanelRight size={16} />
                </button>
              )}
              {task.status === "split" ? (
                <span className="status-pill">已拆分</span>
              ) : task.status === "pending_review" ? (
                <span className="status-pill">
                  <Check size={15} />
                  待验收
                </span>
              ) : task.status === "completed" ? (
                <span className="status-pill">已完成</span>
              ) : task.status === "archived" ? (
                <span className="status-pill">已归档</span>
              ) : isActiveTask ? (
                <span className="small-button active-action" aria-label="当前正在执行的任务">
                  <Activity size={15} />
                  执行中
                </span>
              ) : (
                <button className="small-button" onClick={() => props.onAction(task.id)}>
                  {props.actionIcon}
                  {props.actionLabel}
                </button>
              )}
              {props.onSplit && task.status !== "completed" && task.status !== "split" && task.status !== "archived" && (
                <button className="icon-button small" title="拆分任务" onClick={() => props.onSplit?.(task.id)}>
                  <Split size={16} />
                </button>
              )}
              {props.onComplete && canSubmitReview && (
                <button className="icon-button small" title="提交验收" onClick={() => props.onComplete?.(task.id)}>
                  <Check size={16} />
                </button>
              )}
              {props.onRemove && (
                <button className="icon-button small" title="移回活动清单" onClick={() => props.onRemove?.(task.id)}>
                  <X size={16} />
                </button>
              )}
              {props.onDelete && (
                <button className="icon-button small danger" title="删除任务" onClick={() => props.onDelete?.(task.id)}>
                  <Trash2 size={16} />
                </button>
              )}
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function TaskProgressBar({ percent }: { percent: number }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="task-progress-bar" aria-label={`任务进度 ${safe}%`}>
      <span style={{ width: `${safe}%` }} />
      <strong>{safe}%</strong>
    </div>
  );
}

function PomodoroProgress(props: { actual: number; estimate: number }) {
  const estimate = Math.max(0, Math.round(props.estimate));
  const actual = Math.max(0, Math.round(props.actual));
  const visibleCount = Math.min(Math.max(estimate, actual, 1), 8);
  const overflow = Math.max(0, Math.max(estimate, actual) - visibleCount);

  return (
    <div className="pomodoro-progress" aria-label={`已完成 ${actual} 个番茄，估算 ${estimate} 个番茄`}>
      <strong>{actual}/{estimate}</strong>
      <div className="pomodoro-dots" aria-hidden="true">
        {Array.from({ length: visibleCount }, (_, index) => (
          <span
            className={[
              "pomodoro-dot",
              index < actual ? "done" : "",
              index >= estimate ? "extra" : "",
            ].filter(Boolean).join(" ")}
            key={index}
          />
        ))}
        {overflow > 0 && <span className="pomodoro-overflow">+{overflow}</span>}
      </div>
      <span>番茄</span>
    </div>
  );
}

export function TaskDetailModal(props: React.ComponentProps<typeof TaskDetailPanel>) {
  useEffect(() => {
    if (!props.task) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.close();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [props]);

  if (!props.task) return null;

  return (
    <div
      className="modal-backdrop task-detail-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) props.close();
      }}
    >
      <section className="modal-panel task-detail-modal" role="dialog" aria-modal="true" aria-label={`任务详情：${props.task.title}`}>
        <TaskDetailPanel {...props} />
      </section>
    </div>
  );
}

export function TaskDetailPanel(props: {
  task?: Task;
  projects: AppState["projects"];
  projectMembers: ProjectMember[];
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  updateTaskProgress: (taskId: string, progressPercent: number, progressNote: string) => void;
  acceptTask: (taskId: string) => void;
  returnTaskForReview: (taskId: string, reason: string) => void;
  close: () => void;
  splitTask: (taskId: string) => void;
  canEdit?: boolean;
  canReview?: boolean;
  lockProject?: boolean;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
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

  const addSubtask = () => {
    const title = subtaskTitle.trim();
    if (!title) return;
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: [
        ...(current.subtasks ?? []),
        { id: uid("subtask"), title, completed: false, createdAt: nowIso() },
      ],
    }));
    setSubtaskTitle("");
  };

  const updateSubtask = (subtaskId: string, patch: Partial<Subtask>) => {
    updateTask(task.id, (current) => ({
      ...current,
      subtasks: (current.subtasks ?? []).map((subtask) =>
        subtask.id === subtaskId
          ? {
              ...subtask,
              ...patch,
              completedAt: patch.completed ? nowIso() : patch.completed === false ? undefined : subtask.completedAt,
            }
          : subtask,
      ),
    }));
  };

  const completedSubtasks = (task.subtasks ?? []).filter((subtask) => subtask.completed).length;
  const taskProject = props.projects.find((project) => project.id === task.projectId) ?? props.projects[0];
  const projectMembers = props.projectMembers.filter((member) => member.projectId === taskProject?.id);
  const executors = projectMembers.filter((member) => member.roles.includes("executor"));
  const collaboratorIds = task.collaboratorMemberIds ?? [];
  const toggleCollaborator = (memberId: string, checked: boolean) => {
    const nextIds = checked
      ? Array.from(new Set([...collaboratorIds, memberId]))
      : collaboratorIds.filter((id) => id !== memberId);
    props.updateTaskAssignment(task.id, { collaboratorMemberIds: nextIds });
  };

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

      <div className="detail-section">
        <div className="detail-section-heading">
          <strong>基本信息</strong>
          <span>任务是什么、属于哪个项目、优先级如何。</span>
        </div>
        <div className="detail-grid">
          <label className="span-2">
            标题
            <input value={task.title} disabled={!canEdit} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
          </label>
          <label>
            项目
            {props.lockProject ? (
              <input value={taskProject?.name ?? "未命名项目"} disabled />
            ) : (
              <select
                value={taskProject?.id ?? ""}
                disabled={!canEdit}
                onChange={(event) =>
                  props.updateTaskAssignment(task.id, {
                    projectId: event.target.value,
                    primaryExecutorMemberId: "",
                    collaboratorMemberIds: [],
                  })
                }
              >
                {props.projects.map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            )}
          </label>
          <label>
            标签
            <input
              value={task.tags.join(", ")}
              disabled={!canEdit}
              onChange={(event) =>
                updateTask(task.id, {
                  tags: event.target.value
                    .split(/[,\s，]+/)
                    .map((item) => item.trim())
                    .filter(Boolean),
                })
              }
            />
          </label>
          <label>
            优先级
            <select value={task.priority} disabled={!canEdit} onChange={(event) => updateTask(task.id, { priority: event.target.value as Priority })}>
              <option value="urgent">紧急</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label>
            阶段
            <select value={task.stage} disabled={!canEdit} onChange={(event) => updateTask(task.id, { stage: event.target.value as TaskStage })}>
              {taskStageOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
          <label>
            严重度
            <select value={task.severity} disabled={!canEdit} onChange={(event) => updateTask(task.id, { severity: event.target.value as Severity })}>
              <option value="very_high">非常高</option>
              <option value="high">高</option>
              <option value="medium">中</option>
              <option value="low">低</option>
            </select>
          </label>
          <label className="span-2">
            备注
            <textarea value={task.notes} disabled={!canEdit} onChange={(event) => updateTask(task.id, { notes: event.target.value })} />
          </label>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <strong>执行与进展</strong>
          <span>谁负责、做了多少、现在卡在哪里。</span>
        </div>
        <div className="detail-grid">
          <label>
            主执行人
            <select
              value={task.primaryExecutorMemberId ?? ""}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskAssignment(task.id, { primaryExecutorMemberId: event.target.value })}
            >
              <option value="">未分配</option>
              {executors.map((member) => (
                <option key={member.id} value={member.id}>{member.name}</option>
              ))}
            </select>
          </label>
          <label>
            进度百分比
            <input
              type="number"
              min="0"
              max="100"
              value={task.progressPercent ?? 0}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskProgress(task.id, Number(event.target.value), task.progressNote ?? "")}
            />
          </label>
          <label>
            估算番茄
            <input
              type="number"
              min="0"
              max="30"
              value={task.estimatePomodoros}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { estimatePomodoros: Number(event.target.value) })}
            />
          </label>
          <label>
            实际番茄
            <input
              type="number"
              min="0"
              value={task.actualPomodoros}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { actualPomodoros: Number(event.target.value) })}
            />
          </label>
          <label className="span-2">
            进展说明
            <textarea
              value={task.progressNote ?? ""}
              disabled={!canEdit}
              onChange={(event) => props.updateTaskProgress(task.id, task.progressPercent ?? 0, event.target.value)}
              placeholder="说明刚完成了什么、还剩什么，或为什么偏离预期"
            />
          </label>
        </div>
      </div>

      <div className="detail-section">
        <div className="detail-section-heading">
          <strong>排期与重复</strong>
          <span>期望什么时候开始、什么时候交付。</span>
        </div>
        <div className="detail-grid">
          <label>
            预计开始
            <input
              type="datetime-local"
              value={formatDateTimeLocal(task.expectedStartAt)}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { expectedStartAt: parseDateTimeLocal(event.target.value) })}
            />
          </label>
          <label>
            预计完成
            <input
              type="datetime-local"
              value={formatDateTimeLocal(task.expectedFinishAt)}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { expectedFinishAt: parseDateTimeLocal(event.target.value) })}
            />
          </label>
          <label>
            到期日
            <input
              type="datetime-local"
              value={formatDateTimeLocal(task.dueAt)}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { dueAt: parseDateTimeLocal(event.target.value) })}
            />
          </label>
          <label>
            提醒
            <input
              type="datetime-local"
              value={formatDateTimeLocal(task.reminderAt)}
              disabled={!canEdit}
              onChange={(event) => updateTask(task.id, { reminderAt: parseDateTimeLocal(event.target.value) })}
            />
          </label>
          <label>
            重复
            <select value={task.repeatRule ?? "none"} disabled={!canEdit} onChange={(event) => updateTask(task.id, { repeatRule: event.target.value as RepeatRule })}>
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
              value={task.repeatIntervalDays ?? 1}
              onChange={(event) => updateTask(task.id, { repeatIntervalDays: Number(event.target.value) })}
              disabled={!canEdit || ((task.repeatRule ?? "none") !== "interval" && (task.repeatRule ?? "none") !== "after_completion")}
            />
          </label>
        </div>
      </div>

      <div className="subtask-box">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">协作成员</p>
            <h2>协作者</h2>
          </div>
        </div>
        <div className="toggle-row">
          {projectMembers.map((member) => (
            <label key={member.id}>
              <input
                type="checkbox"
                checked={collaboratorIds.includes(member.id)}
                disabled={!canEdit || member.id === task.primaryExecutorMemberId}
                onChange={(event) => toggleCollaborator(member.id, event.target.checked)}
              />
              {member.name}
            </label>
          ))}
          {!projectMembers.length && <p className="empty">这个项目还没有成员。</p>}
        </div>
      </div>

      <div className="detail-summary">
        <Metric icon={<Check size={17} />} label="子任务" value={`${completedSubtasks}/${task.subtasks.length}`} />
        <Metric icon={<AlarmClock size={17} />} label="偏差" value={estimateDeltaLabel(task.estimatePomodoros, task.actualPomodoros)} />
      </div>

      {task.reviewReturnReason && task.status !== "pending_review" && (
        <p className="warning-line compact">最近退回原因：{task.reviewReturnReason}</p>
      )}

      {task.status === "pending_review" && canReview && (
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
            <button className="primary-button" disabled={!canReview} onClick={() => props.acceptTask(task.id)}>
              <Check size={16} />
              验收通过
            </button>
            <button
              className="secondary-button"
              onClick={() => {
                props.returnTaskForReview(task.id, returnReason);
                setReturnReason("");
              }}
              disabled={!canReview || !returnReason.trim()}
            >
              退回任务
            </button>
          </div>
        </div>
      )}

      <div className="subtask-box">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">子任务</p>
            <h2>子任务</h2>
          </div>
        </div>
        <div className="subtask-add">
          <input
            value={subtaskTitle}
            disabled={!canEdit}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            placeholder="添加子任务"
          />
          <button className="secondary-button" disabled={!canEdit} onClick={addSubtask}>
            <Plus size={16} />
            添加
          </button>
        </div>
        <div className="subtask-list">
          {task.subtasks.map((subtask) => (
            <label className="subtask-row" key={subtask.id}>
              <input
                type="checkbox"
                checked={subtask.completed}
                disabled={!canEdit}
                onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })}
              />
              <span className={subtask.completed ? "done" : ""}>{subtask.title}</span>
              <button
                type="button"
                className="icon-button small"
                title="删除子任务"
                disabled={!canEdit}
                onClick={() =>
                  updateTask(task.id, (current) => ({
                    ...current,
                    subtasks: current.subtasks.filter((item) => item.id !== subtask.id),
                  }))
                }
              >
                <Trash2 size={15} />
              </button>
            </label>
          ))}
        </div>
      </div>

      {task.status !== "completed" && task.status !== "split" && task.status !== "archived" && (
        <button className="primary-button" disabled={!canEdit} onClick={() => props.splitTask(task.id)}>
          <Split size={16} />
          {task.estimatePomodoros > 7 ? "拆分大任务" : "拆分任务"}
        </button>
      )}
    </section>
  );
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="metric">
      {icon}
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
