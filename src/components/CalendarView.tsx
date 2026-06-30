import { CalendarDays, Check, ClipboardList, Clock3, Plus, RotateCcw } from "lucide-react";
import { useMemo, useState } from "react";
import { calendarSummaries } from "../planning";
import { todayKey, uid } from "../seed";
import { modeLabel, taskStageOptions } from "../appModel";
import type { AppState, CalendarViewMode, DailyReview, Priority, Severity, TaskStage, TaskTemplate } from "../types";

const startOfWeek = (date: Date) => {
  const copy = new Date(date);
  const day = copy.getDay() || 7;
  copy.setDate(copy.getDate() - day + 1);
  return todayKey(copy);
};

const startOfMonth = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-01`;

export function CalendarView(props: {
  state: AppState;
  mode: CalendarViewMode;
  setMode: (mode: CalendarViewMode) => void;
  instantiateTaskTemplate: (template: TaskTemplate) => void;
  saveTaskTemplate: (template: TaskTemplate) => void;
  deleteTaskTemplate: (templateId: string) => void;
  scheduleTaskForDate: (date: string, taskId: string) => void;
  openTask: (taskId: string) => void;
}) {
  const { state, mode, setMode, instantiateTaskTemplate, saveTaskTemplate, deleteTaskTemplate, scheduleTaskForDate, openTask } = props;
  const [cursor, setCursor] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [scheduleTaskId, setScheduleTaskId] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<TaskTemplate | null>(null);
  const startDate = mode === "week" ? startOfWeek(cursor) : startOfMonth(cursor);
  const days = mode === "week" ? 7 : 42;
  const summaries = useMemo(() => calendarSummaries(state, startDate, days), [state, startDate, days]);
  const selected = summaries.find((item) => item.date === selectedDate) ?? summaries.find((item) => item.date === todayKey()) ?? summaries[0];
  const selectedPlan = selected ? state.dailyPlans.find((plan) => plan.date === selected.date) : undefined;
  const selectedTasks = selected?.committedTaskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean) ?? [];
  const overdueTasks = selected?.overdueTaskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean) ?? [];
  const reminderTasks = selected?.reminderTaskIds.map((id) => state.tasks.find((task) => task.id === id)).filter(Boolean) ?? [];
  const schedulableTasks = state.tasks.filter((task) => task.status !== "completed" && task.status !== "split" && task.status !== "archived" && !selected?.committedTaskIds.includes(task.id));
  const selectedDateKey = selected?.date ?? todayKey();
  const selectedSessions = useMemo(
    () => state.focusSessions.filter((item) => item.startedAt.slice(0, 10) === selectedDateKey),
    [state.focusSessions, selectedDateKey],
  );
  const selectedInterruptions = useMemo(
    () => state.interruptions.filter((item) => item.createdAt.slice(0, 10) === selectedDateKey),
    [state.interruptions, selectedDateKey],
  );
  const review = selectedPlan?.review as DailyReview | undefined;
  const reviewLabel = review?.mood === "low" ? "偏低" : review?.mood === "normal" ? "普通" : review?.mood === "good" ? "良好" : review?.mood === "great" ? "优秀" : "未回顾";

  const shiftCursor = (step: number) => {
    setCursor((value) => {
      const next = new Date(value);
      if (mode === "week") next.setDate(value.getDate() + step * 7);
      else next.setMonth(value.getMonth() + step);
      return next;
    });
  };

  return (
    <div className="calendar-layout">
      <section className="band calendar-toolbar">
        <div>
          <p className="eyebrow">历史日报</p>
          <h2>历史日报</h2>
          <p className="muted compact-copy">选择日期后查看当天计划、番茄记录、提醒和回顾。</p>
        </div>
        <div className="segmented">
          <button className={mode === "week" ? "active" : ""} onClick={() => setMode("week")}>周</button>
          <button className={mode === "month" ? "active" : ""} onClick={() => setMode("month")}>月</button>
        </div>
        <div className="button-row">
          <button className="secondary-button" onClick={() => shiftCursor(-1)}>上一段</button>
          <button className="secondary-button" onClick={() => setCursor(new Date())}>
            <RotateCcw size={15} />
            今天
          </button>
          <button className="secondary-button" onClick={() => shiftCursor(1)}>下一段</button>
        </div>
      </section>

      <section className={`band calendar-grid calendar-${mode}`}>
        {summaries.map((day) => (
          <button
            className={day.date === selected?.date ? "calendar-day selected" : "calendar-day"}
            key={day.date}
            onClick={() => setSelectedDate(day.date)}
          >
            <span>{day.date.slice(5)}</span>
            <strong>{day.completedPomodoros}/{Math.max(1, day.plannedPomodoros)}</strong>
            <small>{day.reviewed ? "已回顾" : day.interruptionCount ? `${day.interruptionCount} 中断` : "待推进"}</small>
            <div className="calendar-markers">
              {day.overdueTaskIds.length > 0 && <i className="danger-dot" />}
              {day.reminderTaskIds.length > 0 && <i className="accent-dot" />}
              {day.reviewed && <Check size={12} />}
            </div>
          </button>
        ))}
      </section>

      <div className="calendar-detail-grid">
        <section className="band day-detail">
          <div className="section-title">
            <div>
              <p className="eyebrow">当日明细</p>
              <h2>{selected?.date ?? todayKey()} 详情</h2>
            </div>
            <CalendarDays size={20} />
          </div>
          <div className="metric-row compact-metrics">
            <MiniMetric label="完成番茄" value={`${selected?.completedPomodoros ?? 0}`} />
            <MiniMetric label="计划番茄" value={`${selected?.plannedPomodoros ?? 0}`} />
            <MiniMetric label="中断" value={`${selected?.interruptionCount ?? 0}`} />
            <MiniMetric label="作废" value={`${selected?.abortedPomodoros ?? 0}`} />
            {selected && <MiniMetric label="回顾状态" value={selectedPlan?.reviewedAt ? "已回顾" : "未回顾"} />}
          </div>
          <div className="day-review-summary">
            <div className="section-title">
              <div>
                <p className="eyebrow">回顾快照</p>
                <h3>当天复盘</h3>
              </div>
              <CalendarDays size={20} />
            </div>
            {selectedPlan?.reviewedAt ? (
              <div className="review-content">
                <p>
                  回顾时间 <strong>{new Date(selectedPlan.reviewedAt).toLocaleString()}</strong>
                </p>
                <p>
                  今日状态 <strong>{reviewLabel}</strong>
                </p>
                <div className="review-grid">
                  <p>{review?.wins ? `收获：${review.wins}` : "收获：暂无填写"}</p>
                  <p>{review?.blockers ? `阻碍：${review.blockers}` : "阻碍：暂无填写"}</p>
                  <p>{review?.interruptionPattern ? `中断模式：${review.interruptionPattern}` : "中断模式：暂无分析"}</p>
                  <p>{review?.tomorrowFocus ? `明日注意：${review.tomorrowFocus}` : "明日注意：暂无填写"}</p>
                </div>
              </div>
            ) : (
              <p className="muted">该日尚未完成回顾。建议前往工作台对应日期完成回顾后在此核对。</p>
            )}
          </div>
          <div className="day-task-list">
          {selectedTasks.map((task) => (
            <button className="day-task-item" key={task!.id} onClick={() => openTask(task!.id)}>
              <strong>{task!.title}</strong>
              <span>{task!.project} · {task!.estimatePomodoros} 番茄</span>
            </button>
          ))}
          {!selectedTasks.length && <p className="empty">这一天还没有承诺任务。</p>}
          </div>
          <div className="timeline-section">
            <div className="section-title">
              <div>
                <p className="eyebrow">执行时间线</p>
                <h3>日内番茄与中断</h3>
              </div>
              <Clock3 size={20} />
            </div>
            <div className="timeline">
              {selectedSessions.map((session) => {
                const task = session.taskId ? state.tasks.find((item) => item.id === session.taskId) : undefined;
                return (
                  <article className="timeline-item" key={session.id}>
                    <span />
                    <div>
                      <strong>{task?.title ?? modeLabel[session.mode]}</strong>
                      <p>
                        {new Date(session.startedAt).toLocaleString()} · {session.outcome ?? "进行中"} · 内/外中断{" "}
                        {session.interruptionCounts.internal}/{session.interruptionCounts.external}
                      </p>
                      {task && <button className="link-button" onClick={() => openTask(task.id)}>查看任务</button>}
                    </div>
                  </article>
                );
              })}
              {selectedInterruptions.map((item) => (
                <article className="timeline-item" key={item.id}>
                  <span />
                  <div>
                    <strong>中断记录</strong>
                    <p>
                      {new Date(item.createdAt).toLocaleString()} · {item.type === "internal" ? "内部" : "外部"}
                    </p>
                    <small>{item.note}</small>
                  </div>
                </article>
              ))}
              {!selectedSessions.length && !selectedInterruptions.length && <p className="empty">当天还没有可追溯记录。</p>}
            </div>
            {selectedInterruptions.filter((item) => item.type === "external").length > 0 && (
              <p className="muted">外部中断较多，建议在专注前再清理消息源。</p>
            )}
          </div>
          {overdueTasks.length > 0 && (
            <div className="warning-line">
              过期未完成：{overdueTasks.map((task) => task!.title).join("、")}
            </div>
          )}
          {reminderTasks.length > 0 && (
            <div className="muted">
              提醒任务：{reminderTasks.map((task) => task!.title).join("、")}
            </div>
          )}
          <div className="schedule-box">
            <label>
              排入这一天
              <select value={scheduleTaskId} onChange={(event) => setScheduleTaskId(event.target.value)}>
                <option value="">选择任务</option>
                {schedulableTasks.map((task) => (
                  <option key={task.id} value={task.id}>{task.title}</option>
                ))}
              </select>
            </label>
            <button
              className="primary-button"
              disabled={!scheduleTaskId || !selected}
              onClick={() => {
                if (!selected || !scheduleTaskId) return;
                scheduleTaskForDate(selected.date, scheduleTaskId);
                setScheduleTaskId("");
              }}
            >
              加入计划
            </button>
          </div>
        </section>

        <section className="band template-panel">
          <div className="section-title">
            <div>
              <p className="eyebrow">任务模板</p>
              <h2>可复用任务模板</h2>
            </div>
            <ClipboardList size={20} />
          </div>
          <TemplateEditor
            template={editingTemplate}
            onChange={setEditingTemplate}
            onNew={() =>
              setEditingTemplate({
                id: uid("template"),
                name: "自定义模板",
                description: "",
                project: "Inbox",
                tags: [],
                priority: "medium",
                severity: "medium",
                stage: "requirements",
                estimatePomodoros: 1,
                subtasks: [],
              })
            }
            onSave={() => {
              if (!editingTemplate) return;
              saveTaskTemplate(editingTemplate);
              setEditingTemplate(null);
            }}
            onCancel={() => setEditingTemplate(null)}
          />
          <div className="template-list">
            {state.taskTemplates.map((template) => (
              <article className="template-item" key={template.id}>
                <div>
                  <strong>{template.name}</strong>
                  <span>{template.description}</span>
                  <small>{template.project} · {template.estimatePomodoros} 番茄 · {template.subtasks.length} 子任务</small>
                </div>
                <button className="small-button" onClick={() => instantiateTaskTemplate(template)}>
                  <Plus size={15} />
                  生成
                </button>
                <button className="small-button" onClick={() => setEditingTemplate(template)}>
                  编辑
                </button>
                <button className="small-button" onClick={() => deleteTaskTemplate(template.id)}>
                  删除
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function TemplateEditor(props: {
  template: TaskTemplate | null;
  onChange: (template: TaskTemplate | null) => void;
  onNew: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  if (!props.template) {
    return (
      <button className="secondary-button" onClick={props.onNew}>
        <Plus size={15} />
        新建模板
      </button>
    );
  }
  const template = props.template;
  const update = (patch: Partial<TaskTemplate>) => props.onChange({ ...template, ...patch });
  return (
    <div className="template-editor">
      <label>
        名称
        <input value={template.name} onChange={(event) => update({ name: event.target.value })} />
      </label>
      <label>
        项目
        <input value={template.project} onChange={(event) => update({ project: event.target.value })} />
      </label>
      <label>
        标签
        <input value={template.tags.join(", ")} onChange={(event) => update({ tags: event.target.value.split(/[,\s，]+/).filter(Boolean) })} />
      </label>
      <label>
        番茄
        <input type="number" min="1" max="12" value={template.estimatePomodoros} onChange={(event) => update({ estimatePomodoros: Number(event.target.value) })} />
      </label>
      <label>
        优先级
        <select value={template.priority} onChange={(event) => update({ priority: event.target.value as Priority })}>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="urgent">紧急</option>
        </select>
      </label>
      <label>
        严重度
        <select value={template.severity} onChange={(event) => update({ severity: event.target.value as Severity })}>
          <option value="low">低</option>
          <option value="medium">中</option>
          <option value="high">高</option>
          <option value="very_high">非常高</option>
        </select>
      </label>
      <label>
        阶段
        <select value={template.stage ?? "requirements"} onChange={(event) => update({ stage: event.target.value as TaskStage })}>
          {taskStageOptions.map((option) => (
            <option key={option.value} value={option.value}>{option.label}</option>
          ))}
        </select>
      </label>
      <label className="span-2">
        说明
        <textarea value={template.description} onChange={(event) => update({ description: event.target.value })} />
      </label>
      <label className="span-2">
        子任务
        <textarea value={template.subtasks.join("\n")} onChange={(event) => update({ subtasks: event.target.value.split(/\n+/).map((item) => item.trim()).filter(Boolean) })} />
      </label>
      <div className="button-row span-2">
        <button className="primary-button" onClick={props.onSave}>保存模板</button>
        <button className="secondary-button" onClick={props.onCancel}>取消</button>
      </div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric">
      <Clock3 size={16} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
