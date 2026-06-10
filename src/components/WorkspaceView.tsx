import type React from "react";
import { useState } from "react";
import { Activity, AlarmClock, ArrowDown, ArrowUp, Check, ChevronRight, PanelRight, Play, Plus, SlidersHorizontal, Sparkles, Split, Square, Target, Trash2, X } from "lucide-react";
import { abortedSessionsOnDate, coachSteps, dailyCompletionRate, estimateDeltaLabel, interruptionsOnDate, planPressure, sessionsForTask, taskSuggestions, unresolvedInterruptions } from "../domain";
import { formatDateTimeLocal, labelPriority, nowIso, parseDateTimeLocal, today, type TaskDraft, type TaskFilters, type TaskSort } from "../appModel";
import { uid } from "../seed";
import type { AppState, CoachStepId, DailyPlan, Priority, ProjectMember, RepeatRule, Severity, Subtask, Task } from "../types";

export function WorkspaceView(props: {
  state: AppState;
  draft: TaskDraft;
  setDraft: (draft: TaskDraft) => void;
  addTask: () => void;
  poolTasks: Task[];
  committedTasks: Task[];
  todayPlan: DailyPlan;
  selectedTask?: Task;
  taskFilters: TaskFilters;
  setTaskFilters: (filters: TaskFilters) => void;
  capacityHint: number;
  totalCommittedEstimate: number;
  commitTask: (taskId: string) => void;
  removeCommittedTask: (taskId: string) => void;
  completeTask: (taskId: string) => void;
  deleteTask: (taskId: string) => void;
  selectTask: (taskId: string | null) => void;
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  moveCommittedTask: (taskId: string, direction: -1 | 1) => void;
  updatePlanCapacity: (capacity: number) => void;
  acknowledgeOverload: () => void;
  generateTodayPlan: () => void;
  dismissCoachStep: (stepId: CoachStepId) => void;
  splitTask: (taskId: string) => void;
  beginFocus: (taskId: string) => void;
  updateReflection: (reflection: string) => void;
  updateReview: (patch: Partial<DailyPlan["review"]>) => void;
  completeReview: () => void;
  resolveInterruption: (interruptionId: string) => void;
  convertInterruptionToTask: (interruptionId: string) => void;
}) {
  const {
    state,
    draft,
    setDraft,
    addTask,
    poolTasks,
    committedTasks,
    todayPlan,
    selectedTask,
    taskFilters,
    setTaskFilters,
    capacityHint,
    totalCommittedEstimate,
    commitTask,
    removeCommittedTask,
    completeTask,
    deleteTask,
    selectTask,
    updateTask,
    updateTaskAssignment,
    moveCommittedTask,
    updatePlanCapacity,
    acknowledgeOverload,
    generateTodayPlan,
    dismissCoachStep,
    splitTask,
    beginFocus,
    updateReflection,
    updateReview,
    completeReview,
    resolveInterruption,
    convertInterruptionToTask,
  } = props;

  const remainingEstimate = Math.max(0, totalCommittedEstimate - todayPlan.completedPomodoros);
  const overload = totalCommittedEstimate > todayPlan.capacityPomodoros;
  const projects = Array.from(new Set(state.tasks.map((task) => task.project))).sort();
  const tags = Array.from(new Set(state.tasks.flatMap((task) => task.tags))).sort();
  const completionRate = dailyCompletionRate(state, todayPlan);
  const abortedToday = abortedSessionsOnDate(state, today()).length;
  const interruptionsToday = interruptionsOnDate(state, today());
  const inbox = unresolvedInterruptions(state).slice(0, 6);
  const lowEstimateTasks = state.tasks
    .map((task) => ({ task, actual: sessionsForTask(state, task.id).length || task.actualPomodoros }))
    .filter(({ task, actual }) => actual - task.estimatePomodoros >= 2)
    .slice(0, 3);
  const pressure = planPressure(state, todayPlan);
  const suggestions = taskSuggestions(state, todayPlan.date, 5);
  const guideSteps = coachSteps(state, todayPlan.date).filter((step) => !(state.settings.dismissedCoachSteps ?? []).includes(step.id));
  const nextGuideStep = guideSteps.find((step) => !step.completed);
  const currentMember = state.projectMembers.find((member) => member.id === state.currentMemberId) ?? state.projectMembers[0];
  const assignedTasks = currentMember
    ? state.tasks
        .filter((task) => task.primaryExecutorMemberId === currentMember.id)
        .filter((task) => task.status !== "completed" && task.status !== "archived")
        .sort((left, right) => {
          const leftActive = state.activeTimer?.taskId === left.id ? 0 : 1;
          const rightActive = state.activeTimer?.taskId === right.id ? 0 : 1;
          if (leftActive !== rightActive) return leftActive - rightActive;
          return left.sortOrder - right.sortOrder;
        })
    : [];
  const activeAssignedTask = assignedTasks.find((task) => task.id === state.activeTimer?.taskId);
  const progressUpdateTasks = assignedTasks.filter(
    (task) => (task.status === "in_progress" || task.actualPomodoros > 0) && (task.progressPercent ?? 0) < 100,
  );
  const [showAdvancedTask, setShowAdvancedTask] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showGuidance, setShowGuidance] = useState(false);
  const [showReview, setShowReview] = useState(
    Boolean(todayPlan.reviewedAt || new Date().getHours() >= 18),
  );

  return (
    <div className="content-grid workspace-grid">
      <section className="band hero-workflow workspace-summary">
        <div className="workspace-summary-copy">
          <p className="eyebrow">Workspace</p>
          <h2>今日只处理承诺任务</h2>
          {overload && !todayPlan.overloadAcknowledged && (
            <div className="warning-line">
              今日计划超出容量 {totalCommittedEstimate - todayPlan.capacityPomodoros} 个番茄。
              <button className="link-button" onClick={acknowledgeOverload}>
                我已确认
              </button>
            </div>
          )}
        </div>
        <div className="commitment-strip" aria-label="承诺进度">
          <span>今日完成</span>
          <strong>{todayPlan.completedPomodoros}</strong>
          <small>目标 {state.rewardState.dailyGoal}</small>
        </div>
        <div className="commitment-strip accent" aria-label="分心成本">
          <span>今日承诺</span>
          <strong className={totalCommittedEstimate > todayPlan.capacityPomodoros ? "danger-text" : ""}>{totalCommittedEstimate}</strong>
          <small>容量 {todayPlan.capacityPomodoros}</small>
        </div>
        <label className="commitment-strip capacity-editor" aria-label="今日容量">
          <span>今日容量</span>
          <input
            type="number"
            min="1"
            max="16"
            value={todayPlan.capacityPomodoros}
            onChange={(event) => updatePlanCapacity(Number(event.target.value))}
          />
          <small>
            建议 {todayPlan.recommendedCapacityPomodoros ?? capacityHint} · 剩余 {remainingEstimate}
          </small>
        </label>
        <button className="secondary-button workspace-more" onClick={() => setShowGuidance((value) => !value)}>
          <Sparkles size={16} />
          {showGuidance ? "收起辅助" : "展开辅助"}
        </button>
      </section>

      <PersonalWorkbench
        currentMember={currentMember}
        assignedTasks={assignedTasks}
        activeTask={activeAssignedTask}
        progressUpdateTasks={progressUpdateTasks}
        beginFocus={beginFocus}
        selectTask={selectTask}
      />

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
            <p className="eyebrow">Daily Commitment</p>
            <h2>今日计划助手</h2>
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
          <span>已承诺 {pressure.totalEstimate} / 容量 {todayPlan.capacityPomodoros}，剩余 {pressure.remainingEstimate}</span>
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

      <section className="band add-task compact-add-task">
        <div className="compact-add-title">
          <Plus size={17} />
          <strong>快速添加</strong>
        </div>

        <div className="task-form compact-task-form">
          <label className="quick-title">
            <span className="sr-only">任务名称</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft({ ...draft, title: event.target.value })}
              placeholder="例如：整理严格模式权限说明"
              onKeyDown={(event) => {
                if (event.key === "Enter") addTask();
              }}
            />
          </label>
          <label className="quick-estimate">
            <span className="sr-only">估算番茄</span>
            <input
              type="number"
              min="0"
              max="12"
              value={draft.estimatePomodoros}
              onChange={(event) => setDraft({ ...draft, estimatePomodoros: Number(event.target.value) })}
            />
          </label>
        </div>
        <button className="primary-button" onClick={addTask}>
          <Plus size={16} />
          添加
        </button>
        <button className="secondary-button compact-toggle" onClick={() => setShowAdvancedTask((value) => !value)}>
          <SlidersHorizontal size={16} />
          {showAdvancedTask ? "收起" : "更多"}
        </button>
        {showAdvancedTask && (
          <div className="task-form advanced-task-form">
          <label>
            项目
            <input value={draft.project} onChange={(event) => setDraft({ ...draft, project: event.target.value })} />
          </label>
          <label>
            标签
            <input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} />
          </label>
          <label>
            优先级
            <select value={draft.priority} onChange={(event) => setDraft({ ...draft, priority: event.target.value as Priority })}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="urgent">紧急</option>
            </select>
          </label>
          <label>
            严重度
            <select value={draft.severity} onChange={(event) => setDraft({ ...draft, severity: event.target.value as Severity })}>
              <option value="low">低</option>
              <option value="medium">中</option>
              <option value="high">高</option>
              <option value="very_high">非常高</option>
            </select>
          </label>
          <label>
            到期日
            <input type="datetime-local" value={draft.dueAt} onChange={(event) => setDraft({ ...draft, dueAt: event.target.value })} />
          </label>
          <label>
            提醒
            <input type="datetime-local" value={draft.reminderAt} onChange={(event) => setDraft({ ...draft, reminderAt: event.target.value })} />
          </label>
          <label>
            重复
            <select value={draft.repeatRule} onChange={(event) => setDraft({ ...draft, repeatRule: event.target.value as RepeatRule })}>
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
              value={draft.repeatIntervalDays}
              disabled={draft.repeatRule !== "interval" && draft.repeatRule !== "after_completion"}
              onChange={(event) => setDraft({ ...draft, repeatIntervalDays: Number(event.target.value) })}
            />
          </label>
          <label className="span-2">
            备注
            <textarea value={draft.notes} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} />
          </label>
        </div>
        )}
        {draft.estimatePomodoros > 7 && <p className="warning">超过 7 个番茄的活动建议拆分，避免计划阶段失真。</p>}
      </section>

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
            <span>今日承诺 {committedTasks.length} · 活动清单 {poolTasks.length}</span>
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
        title="今日承诺"
        eyebrow="只展示今天选择做的事"
        tasks={committedTasks}
        empty="从活动清单中选择今日任务。"
        actionLabel="开始"
        actionIcon={<Play size={15} />}
        onAction={beginFocus}
        onRemove={removeCommittedTask}
        onComplete={completeTask}
        onSelect={selectTask}
        onSplit={splitTask}
        onMove={moveCommittedTask}
      />

      <TaskColumn
        title="活动清单"
        eyebrow="未承诺任务"
        tasks={poolTasks}
        empty="任务池空了，可以补充新活动。"
        actionLabel="选入今日"
        actionIcon={<ChevronRight size={15} />}
        onAction={commitTask}
        onDelete={deleteTask}
        onSelect={selectTask}
        onSplit={splitTask}
      />

      {selectedTask && (
        <div className="task-detail-drawer">
          <TaskDetailPanel
            task={selectedTask}
            projects={state.projects}
            projectMembers={state.projectMembers}
            updateTask={updateTask}
            updateTaskAssignment={updateTaskAssignment}
            close={() => selectTask(null)}
            splitTask={splitTask}
          />
        </div>
      )}

      {!showReview && (
        <section className="band review-nudge">
          <div>
            <p className="eyebrow">Daily Review</p>
            <h2>日终回顾已收起</h2>
          </div>
          <button className="secondary-button" onClick={() => setShowReview(true)}>
            现在打开
          </button>
        </section>
      )}

      {showReview && <section className="band review-panel">
        <div className="section-title">
          <div>
            <p className="eyebrow">Daily Review</p>
            <h2>日终回顾</h2>
          </div>
          <Check size={20} />
        </div>
        <div className="review-stats">
          <Metric icon={<Target size={17} />} label="承诺兑现" value={`${completionRate}%`} />
          <Metric icon={<Square size={17} />} label="作废番茄" value={`${abortedToday}`} />
          <Metric icon={<Activity size={17} />} label="今日中断" value={`${interruptionsToday.length}`} />
        </div>
        <div className="review-grid">
          <label>
            状态
            <select value={todayPlan.review.mood} onChange={(event) => updateReview({ mood: event.target.value as DailyPlan["review"]["mood"] })}>
              <option value="low">低能量</option>
              <option value="normal">稳定</option>
              <option value="good">不错</option>
              <option value="great">高光</option>
            </select>
          </label>
          <label>
            今日收获
            <textarea value={todayPlan.review.wins} onChange={(event) => updateReview({ wins: event.target.value })} />
          </label>
          <label>
            阻碍
            <textarea value={todayPlan.review.blockers} onChange={(event) => updateReview({ blockers: event.target.value })} />
          </label>
          <label>
            中断模式
            <textarea value={todayPlan.review.interruptionPattern} onChange={(event) => updateReview({ interruptionPattern: event.target.value })} />
          </label>
          <label>
            明日注意事项
            <textarea value={todayPlan.review.tomorrowFocus} onChange={(event) => updateReview({ tomorrowFocus: event.target.value })} />
          </label>
        </div>
        {lowEstimateTasks.length > 0 && (
          <div className="insight-list compact">
            {lowEstimateTasks.map(({ task, actual }) => (
              <article className="insight-item" key={task.id}>
                <strong>{task.title}</strong>
                <span>低估 {actual - task.estimatePomodoros} 个番茄，明天优先拆小。</span>
              </article>
            ))}
          </div>
        )}
        <div className="button-row">
          <button className="primary-button" onClick={completeReview}>
            <Check size={16} />
            完成回顾并生成明日建议
          </button>
          <button className="secondary-button" onClick={() => updateReflection(todayPlan.review.wins)}>
            同步到旧总结
          </button>
        </div>
        <p className="muted">
          {todayPlan.reviewedAt
            ? `已于 ${new Date(todayPlan.reviewedAt).toLocaleTimeString()} 完成回顾，建议明日 ${todayPlan.suggestedCapacityPomodoros ?? capacityHint} 个番茄。`
            : "完成回顾后会更新连续天数、徽章和明日容量建议。"}
        </p>
      </section>}

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
    </div>
  );
}

function PersonalWorkbench(props: {
  currentMember?: ProjectMember;
  assignedTasks: Task[];
  activeTask?: Task;
  progressUpdateTasks: Task[];
  beginFocus: (taskId: string) => void;
  selectTask: (taskId: string) => void;
}) {
  return (
    <section className="band personal-workbench">
      <div className="section-title">
        <div>
          <p className="eyebrow">个人任务台</p>
          <h2>我的任务</h2>
        </div>
        <span className="count-pill">{props.assignedTasks.length}</span>
      </div>

      <div className="workbench-stats">
        <div>
          <span>当前执行者</span>
          <strong>{props.currentMember?.name ?? "未选择成员"}</strong>
        </div>
        <div>
          <span>正在进行</span>
          <strong>{props.activeTask?.title ?? "暂无"}</strong>
        </div>
        <div>
          <span>需更新进展</span>
          <strong>{props.progressUpdateTasks.length}</strong>
        </div>
      </div>

      {props.activeTask && (
        <article className="active-work-line">
          <div>
            <strong>{props.activeTask.title}</strong>
            <span>工作会话已启动，管理者可以看到这项任务正在推进。</span>
          </div>
          <button className="small-button" onClick={() => props.selectTask(props.activeTask!.id)}>
            查看详情
          </button>
        </article>
      )}

      <div className="task-list">
        {props.assignedTasks.length === 0 && <p className="empty">当前成员还没有被分配任务。</p>}
        {props.assignedTasks.slice(0, 4).map((task) => (
          <article className={task.id === props.activeTask?.id ? "task-item active-edge" : "task-item"} key={task.id}>
            <div>
              <div className="task-title-row">
                <strong>{task.title}</strong>
                <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
              </div>
              {task.notes && <p>{task.notes}</p>}
              <PomodoroProgress actual={task.actualPomodoros} estimate={task.estimatePomodoros} />
              <div className="task-meta">
                <span>{task.project}</span>
                <span>进度 {task.progressPercent ?? 0}%</span>
                {task.expectedStartAt && <span>预计开始 {new Date(task.expectedStartAt).toLocaleString()}</span>}
                {task.expectedFinishAt && <span>预计完成 {new Date(task.expectedFinishAt).toLocaleString()}</span>}
              </div>
            </div>
            <div className="task-actions">
              <button className="icon-button small" title="任务详情" onClick={() => props.selectTask(task.id)}>
                <PanelRight size={16} />
              </button>
              <button className="small-button" onClick={() => props.beginFocus(task.id)} disabled={task.id === props.activeTask?.id}>
                <Play size={15} />
                {task.id === props.activeTask?.id ? "进行中" : "开始工作"}
              </button>
            </div>
          </article>
        ))}
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
        {props.tasks.map((task) => (
          <article className={task.estimatePomodoros > 7 ? "task-item warning-edge" : "task-item"} key={task.id}>
            <div>
              <div className="task-title-row">
                <strong>{task.title}</strong>
                <span className={`priority priority-${task.priority}`}>{labelPriority[task.priority]}</span>
              </div>
              {task.notes && <p>{task.notes}</p>}
              <PomodoroProgress actual={task.actualPomodoros} estimate={task.estimatePomodoros} />
              <div className="task-meta">
                <span>{task.project}</span>
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
              <button className="small-button" onClick={() => props.onAction(task.id)}>
                {props.actionIcon}
                {props.actionLabel}
              </button>
              {props.onSplit && task.estimatePomodoros > 7 && (
                <button className="icon-button small" title="拆分任务" onClick={() => props.onSplit?.(task.id)}>
                  <Split size={16} />
                </button>
              )}
              {props.onComplete && (
                <button className="icon-button small" title="完成任务" onClick={() => props.onComplete?.(task.id)}>
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
        ))}
      </div>
    </section>
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

function TaskDetailPanel(props: {
  task?: Task;
  projects: AppState["projects"];
  projectMembers: ProjectMember[];
  updateTask: (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => void;
  updateTaskAssignment: (taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) => void;
  close: () => void;
  splitTask: (taskId: string) => void;
}) {
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const { task, updateTask } = props;

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

      <div className="detail-grid">
        <label className="span-2">
          标题
          <input value={task.title} onChange={(event) => updateTask(task.id, { title: event.target.value })} />
        </label>
        <label className="span-2">
          备注
          <textarea value={task.notes} onChange={(event) => updateTask(task.id, { notes: event.target.value })} />
        </label>
        <label>
          项目
          <select
            value={taskProject?.id ?? ""}
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
        </label>
        <label>
          标签
          <input
            value={task.tags.join(", ")}
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
          主执行人
          <select
            value={task.primaryExecutorMemberId ?? ""}
            onChange={(event) => props.updateTaskAssignment(task.id, { primaryExecutorMemberId: event.target.value })}
          >
            <option value="">未分配</option>
            {executors.map((member) => (
              <option key={member.id} value={member.id}>{member.name}</option>
            ))}
          </select>
        </label>
        <label>
          进度
          <input
            type="number"
            min="0"
            max="100"
            value={task.progressPercent ?? 0}
            onChange={(event) => updateTask(task.id, { progressPercent: Number(event.target.value) })}
          />
        </label>
        <label>
          优先级
          <select value={task.priority} onChange={(event) => updateTask(task.id, { priority: event.target.value as Priority })}>
            <option value="urgent">紧急</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          严重度
          <select value={task.severity} onChange={(event) => updateTask(task.id, { severity: event.target.value as Severity })}>
            <option value="very_high">非常高</option>
            <option value="high">高</option>
            <option value="medium">中</option>
            <option value="low">低</option>
          </select>
        </label>
        <label>
          估算番茄
          <input
            type="number"
            min="0"
            max="30"
            value={task.estimatePomodoros}
            onChange={(event) => updateTask(task.id, { estimatePomodoros: Number(event.target.value) })}
          />
        </label>
        <label>
          实际番茄
          <input
            type="number"
            min="0"
            value={task.actualPomodoros}
            onChange={(event) => updateTask(task.id, { actualPomodoros: Number(event.target.value) })}
          />
        </label>
        <label>
          到期日
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.dueAt)}
            onChange={(event) => updateTask(task.id, { dueAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          提醒
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.reminderAt)}
            onChange={(event) => updateTask(task.id, { reminderAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          预计开始
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.expectedStartAt)}
            onChange={(event) => updateTask(task.id, { expectedStartAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          预计完成
          <input
            type="datetime-local"
            value={formatDateTimeLocal(task.expectedFinishAt)}
            onChange={(event) => updateTask(task.id, { expectedFinishAt: parseDateTimeLocal(event.target.value) })}
          />
        </label>
        <label>
          重复
          <select value={task.repeatRule ?? "none"} onChange={(event) => updateTask(task.id, { repeatRule: event.target.value as RepeatRule })}>
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
            disabled={(task.repeatRule ?? "none") !== "interval" && (task.repeatRule ?? "none") !== "after_completion"}
          />
        </label>
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
                disabled={member.id === task.primaryExecutorMemberId}
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

      <div className="subtask-box">
        <div className="section-title compact-title">
          <div>
            <p className="eyebrow">Subtasks</p>
            <h2>子任务</h2>
          </div>
        </div>
        <div className="subtask-add">
          <input
            value={subtaskTitle}
            onChange={(event) => setSubtaskTitle(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") addSubtask();
            }}
            placeholder="添加子任务"
          />
          <button className="secondary-button" onClick={addSubtask}>
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
                onChange={(event) => updateSubtask(subtask.id, { completed: event.target.checked })}
              />
              <span className={subtask.completed ? "done" : ""}>{subtask.title}</span>
              <button
                type="button"
                className="icon-button small"
                title="删除子任务"
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

      {task.estimatePomodoros > 7 && (
        <button className="primary-button" onClick={() => props.splitTask(task.id)}>
          <Split size={16} />
          拆分大任务
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
