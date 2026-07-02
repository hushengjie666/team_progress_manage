import { useState } from "react";
import { Activity, Check, ChevronRight, Play, Sparkles, Target } from "lucide-react";
import { type TaskDraft } from "../appModel";
import type { WorkspaceViewModel } from "../workbenchModel";
import type { ActiveTimer, CoachStepId, Project, ProjectMember, Task } from "../types";
import { TaskDetailModal } from "./TaskDetailPanel";
import { MyProjectTaskFilterPanel } from "./workspace/MyProjectTaskFilterPanel";
import { ProjectOverviewCardsPanel } from "./workspace/ProjectOverviewCardsPanel";
import { TaskColumn } from "./workspace/WorkbenchTaskColumns";
export { TaskDetailModal, TaskDetailPanel } from "./TaskDetailPanel";

const isUnassignedTask = (task: Task) =>
  !task.primaryExecutorMemberId && (task.collaboratorMemberIds ?? []).length === 0;

export function WorkspaceView(props: {
  mode: "board" | "workbench";
  model: WorkspaceViewModel;
  draft: TaskDraft;
  setDraft: (draft: TaskDraft) => void;
  addTask: (projectId?: string) => void;
  selectedWorkbenchProjectIds: string[];
  toggleWorkbenchProject: (projectId: string) => void;
  goalLabel: string;
  todayCapacityPomodoros: number;
  activeTimer?: ActiveTimer;
  projects: Project[];
  projectMembers: ProjectMember[];
  selectedTask?: Task;
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
  reorderProjects: (projectIds: string[]) => void;
  openProjectCreate: () => void;
  openProjectDetail: (projectId: string) => void;
  resolveInterruption: (interruptionId: string) => void;
  convertInterruptionToTask: (interruptionId: string) => void;
}) {
  const {
    model,
    selectedWorkbenchProjectIds,
    toggleWorkbenchProject,
    goalLabel,
    todayCapacityPomodoros,
    activeTimer,
    projects,
    projectMembers,
    selectedTask,
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

  const [showUnassignedPoolTasks, setShowUnassignedPoolTasks] = useState(true);
  const {
    inbox,
    pressure,
    suggestionItems,
    guideSteps,
    nextGuideStep,
    myProjectTaskCards,
    committedWorkbenchTasks,
    poolWorkbenchTasks,
    projectOverviewCards,
  } = model;
  const [showGuidance, setShowGuidance] = useState(false);
  const visiblePoolWorkbenchTasks = showUnassignedPoolTasks
    ? poolWorkbenchTasks
    : poolWorkbenchTasks.filter((task) => !isUnassignedTask(task));
  const hiddenUnassignedPoolTaskCount = poolWorkbenchTasks.length - visiblePoolWorkbenchTasks.length;
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
          openProjectCreate={props.openProjectCreate}
          reorderProjects={props.reorderProjects}
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
        <p className="muted">目标：{goalLabel}</p>
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
          <span>工作队列 {pressure.totalEstimate} / 容量 {todayCapacityPomodoros}，剩余 {pressure.remainingEstimate}</span>
        </div>
        <div className="suggestion-list">
          {suggestionItems.slice(0, 3).map(({ suggestion, task }) => {
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
          {suggestionItems.length === 0 && <p className="empty">任务池没有可推荐任务。</p>}
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
        activeTimer={activeTimer}
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
        activeTimer={activeTimer}
      />
        </>
      )}

      <TaskDetailModal
        task={selectedTask}
        projects={projects}
        projectMembers={projectMembers}
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
