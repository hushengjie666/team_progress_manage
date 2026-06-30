import type React from "react";
import { useEffect, useState } from "react";
import { Activity, Check, ChevronRight, PanelRight, Play, Sparkles, Split, Target, Trash2, X } from "lucide-react";
import { labelPriority, labelTaskStage, type TaskDraft } from "../appModel";
import { type MyProjectTaskCard, type ProjectOverviewCard } from "../projectOverview";
import { deriveWorkspaceModel } from "../workbenchModel";
import type { ActiveTimer, AppState, CoachStepId, DailyPlan, ProjectMember, Task, TaskStatus } from "../types";
import { TaskDetailModal } from "./TaskDetailPanel";
export { TaskDetailModal, TaskDetailPanel } from "./TaskDetailPanel";

const isUnassignedTask = (task: Task) =>
  !task.primaryExecutorMemberId && (task.collaboratorMemberIds ?? []).length === 0;

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
    generateTodayPlan,
    dismissCoachStep,
    splitTask,
    beginFocus,
    resolveInterruption,
    convertInterruptionToTask,
  } = props;

  const [selectedWorkbenchProjectIds, setSelectedWorkbenchProjectIds] = useState<string[]>([]);
  const [showUnassignedPoolTasks, setShowUnassignedPoolTasks] = useState(true);
  const {
    remainingEstimate,
    inbox,
    pressure,
    suggestions,
    guideSteps,
    nextGuideStep,
    currentMember,
    myProjectTaskCards,
    availableWorkbenchProjectIds,
    effectiveWorkbenchProjectIds,
    committedWorkbenchTasks,
    poolWorkbenchTasks,
    projectOverviewCards,
  } = deriveWorkspaceModel(state, todayPlan, totalCommittedEstimate, committedTasks, poolTasks, selectedWorkbenchProjectIds);
  const [showGuidance, setShowGuidance] = useState(false);
  const visiblePoolWorkbenchTasks = showUnassignedPoolTasks
    ? poolWorkbenchTasks
    : poolWorkbenchTasks.filter((task) => !isUnassignedTask(task));
  const hiddenUnassignedPoolTaskCount = poolWorkbenchTasks.length - visiblePoolWorkbenchTasks.length;
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

      <TaskColumn
        title="活动清单"
        eyebrow="待安排任务池"
        titleAccessory={(
          <span className="task-title-accessory">
            <button
              className={showUnassignedPoolTasks ? "unassigned-toggle active" : "unassigned-toggle"}
              onClick={() => setShowUnassignedPoolTasks((value) => !value)}
              role="switch"
              type="button"
              aria-checked={showUnassignedPoolTasks}
            >
              <span>显示未分配</span>
              <i aria-hidden="true" />
            </button>
            <span className="toggle-tooltip" role="tooltip">
              默认显示未分配任务；关闭后隐藏没有执行人和协作者的任务。
              {!showUnassignedPoolTasks && hiddenUnassignedPoolTaskCount > 0 ? ` 当前已隐藏 ${hiddenUnassignedPoolTaskCount} 个。` : ""}
            </span>
          </span>
        )}
        tasks={visiblePoolWorkbenchTasks}
        empty={
          !showUnassignedPoolTasks && hiddenUnassignedPoolTaskCount > 0
            ? "未分配任务已隐藏，当前没有已分配的待安排任务。"
            : selectedWorkbenchProjectIds.length > 0 ? "所选项目里暂无待安排任务。" : "暂无待安排任务。"
        }
        actionLabel="加入队列"
        actionIcon={<ChevronRight size={15} />}
        onAction={commitTask}
        onDelete={deleteTask}
        onSelect={selectTask}
        onSplit={splitTask}
        activeTimer={state.activeTimer}
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
        activeTimer={state.activeTimer}
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
  const openProject = () => props.openProjectDetail(card.projectId);

  return (
    <article
      aria-label={`进入项目 ${card.name}`}
      className={hasRisk || hasPendingReview ? "project-overview-card attention clickable-card" : "project-overview-card clickable-card"}
      onClick={openProject}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      }}
      tabIndex={0}
    >
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
        <button
          className="primary-button"
          onClick={(event) => {
            event.stopPropagation();
            openProject();
          }}
          type="button"
        >
          进入项目
          <ChevronRight size={16} />
        </button>
        <button
          className="secondary-button"
          onClick={(event) => {
            event.stopPropagation();
            props.openProjectSettings();
          }}
          type="button"
        >
          管理成员
        </button>
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
  titleAccessory?: React.ReactNode;
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
  activeTimer?: ActiveTimer;
}) {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);
  const canDragSort = Boolean(props.onMove);

  const moveTaskTo = (taskId: string, targetTaskId: string) => {
    if (!props.onMove || taskId === targetTaskId) return;
    const fromIndex = props.tasks.findIndex((task) => task.id === taskId);
    const toIndex = props.tasks.findIndex((task) => task.id === targetTaskId);
    if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;
    const direction: -1 | 1 = fromIndex < toIndex ? 1 : -1;
    for (let index = fromIndex; index !== toIndex; index += direction) {
      props.onMove(taskId, direction);
    }
  };

  return (
    <section className="band task-column">
      <div className="section-title">
        <div>
          <p className="eyebrow">{props.eyebrow}</p>
          <div className="task-column-title-row">
            <h2>{props.title}</h2>
            {props.titleAccessory}
          </div>
        </div>
        <span className="count-pill">{props.tasks.length}</span>
      </div>
      <div className="task-list">
        {props.tasks.length === 0 && <p className="empty">{props.empty}</p>}
        {props.tasks.map((task) => {
          const isTimerTask = props.activeTimer?.taskId === task.id;
          const isRunningTask = isTimerTask && props.activeTimer?.mode === "focus" && props.activeTimer.isRunning;
          const isPausedTask = isTimerTask && props.activeTimer?.mode === "focus" && !props.activeTimer.isRunning;
          const hasTimerState = isRunningTask || isPausedTask;
          const canSubmitReview = task.status === "committed" || task.status === "in_progress";
          const visibleTags = task.tags.filter((tag) => tag !== task.project && tag !== labelTaskStage[task.stage]);
          const visibleNotes = task.notes.startsWith("由「") && task.notes.endsWith("」拆分而来。") ? "" : task.notes;
          return (
          <article
            className={[
              "task-item",
              canDragSort ? "sortable-task" : "",
              draggingTaskId === task.id ? "dragging-task" : "",
              dragOverTaskId === task.id && draggingTaskId !== task.id ? "drag-over-task" : "",
              task.estimatePomodoros > 7 ? "warning-edge" : "",
              isRunningTask ? "active-edge running-task" : "",
            ].filter(Boolean).join(" ")}
            draggable={canDragSort}
            key={task.id}
            onDragStart={(event) => {
              if (!canDragSort) return;
              setDraggingTaskId(task.id);
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", task.id);
            }}
            onDragEnter={(event) => {
              if (!canDragSort || !draggingTaskId || draggingTaskId === task.id) return;
              event.preventDefault();
              setDragOverTaskId(task.id);
            }}
            onDragOver={(event) => {
              if (!canDragSort || !draggingTaskId || draggingTaskId === task.id) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "move";
              setDragOverTaskId(task.id);
            }}
            onDrop={(event) => {
              if (!canDragSort) return;
              event.preventDefault();
              const sourceTaskId = event.dataTransfer.getData("text/plain") || draggingTaskId;
              if (sourceTaskId) moveTaskTo(sourceTaskId, task.id);
              setDraggingTaskId(null);
              setDragOverTaskId(null);
            }}
            onDragEnd={() => {
              setDraggingTaskId(null);
              setDragOverTaskId(null);
            }}
          >
            <div className="task-main">
              <div className="task-title-row">
                <div className="task-title-main">
                  <strong>{task.title}</strong>
                </div>
                <div className="task-title-badges">
                  {task.status === "pending_review" && (
                    <span className="task-state-chip review-state">
                      <Check size={13} />
                      待验收
                    </span>
                  )}
                  {task.status === "completed" && <span className="task-state-chip">已完成</span>}
                  {task.status === "archived" && <span className="task-state-chip">已归档</span>}
                  {task.status === "split" && <span className="task-state-chip">已拆分</span>}
                  {isPausedTask && <span className="status-pill">已暂停</span>}
                </div>
              </div>
              <div className="task-progress-meta-row">
                <div className="task-meta-strip">
                  <span className="task-inline-chip">{task.project}</span>
                  <span className="task-inline-chip">{labelTaskStage[task.stage]}</span>
                  {visibleTags.slice(0, 2).map((tag) => (
                    <span className="task-inline-chip muted-chip" key={tag}>
                      {tag}
                    </span>
                  ))}
                  {visibleTags.length > 2 && <span className="task-inline-chip muted-chip">+{visibleTags.length - 2}</span>}
                  {task.dueAt && <span className="task-inline-chip muted-chip">到期 {new Date(task.dueAt).toLocaleDateString()}</span>}
                  {task.severity === "very_high" && <span className="task-inline-chip danger-chip">高严重度</span>}
                </div>
                <div className="task-inline-progress">
                  <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
                  <TaskProgressBar percent={task.progressPercent ?? 0} compact />
                  <span className="task-pomodoro-summary">{task.actualPomodoros}/{task.estimatePomodoros} 番茄</span>
                </div>
              </div>
              {visibleNotes && <div className="task-summary-line">
                <p>{visibleNotes}</p>
              </div>}
            </div>
            <div className="task-actions">
              <div className="task-primary-actions">
                {props.onSelect && (
                  <button className="icon-button small" title="任务详情" onClick={() => props.onSelect?.(task.id)}>
                    <PanelRight size={16} />
                  </button>
                )}
                {hasTimerState ? (
                  <span className="small-button active-action" aria-label="当前正在执行的任务">
                    <Activity className="active-action-icon" size={15} />
                    {isPausedTask ? "已暂停" : "执行中"}
                  </span>
                ) : (
                  <button className="small-button task-primary-action" onClick={() => props.onAction(task.id)}>
                    {props.actionIcon}
                    {props.actionLabel}
                  </button>
                )}
              </div>
              <div className="task-secondary-actions">
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
            </div>
          </article>
          );
        })}
      </div>
    </section>
  );
}

function TaskProgressBar({ percent, compact = false }: { percent: number; compact?: boolean }) {
  const safe = Math.max(0, Math.min(100, Math.round(percent)));
  return (
    <div className="task-progress-bar" aria-label={`任务进度 ${safe}%`}>
      <span style={{ width: `${safe}%` }} />
      {!compact && <strong>{safe}%</strong>}
      {compact && <em>{safe}%</em>}
    </div>
  );
}
