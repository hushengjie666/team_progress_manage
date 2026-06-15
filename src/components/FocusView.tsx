import { Activity, BellOff, Check, CirclePause, CirclePlay, Leaf, Pause, Play, RotateCcw, Square, Target } from "lucide-react";
import { completedFocusSessions } from "../domain";
import { formatTime, modeLabel } from "../appModel";
import type { AppState, BlockProfile, InterruptionAction, InterruptionType, SessionMode, SessionOutcome, Task } from "../types";

export function FocusView(props: {
  state: AppState;
  currentTask?: Task;
  committedTasks: Task[];
  activeProfile?: BlockProfile;
  quickNote: string;
  setQuickNote: (value: string) => void;
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  resetTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
  completeTask: (taskId: string) => void;
}) {
  const { state, currentTask, committedTasks, activeProfile, quickNote, setQuickNote } = props;
  const active = state.activeTimer;
  const progress = active ? 100 - (active.remaining / active.duration) * 100 : 0;
  const upcomingBreakMode =
    completedFocusSessions(state).length > 0 && completedFocusSessions(state).length % state.settings.longBreakEvery === 0
      ? "long_break"
      : "short_break";
  const sessionViolations = state.strictViolations.filter((item) => item.sessionId === active?.sessionId).slice(0, 3);

  return (
    <div className="focus-layout">
      <section className="focus-stage">
        <div className="focus-orbit" style={{ background: `conic-gradient(#1f9d8a ${progress}%, #e7e1d8 ${progress}% 100%)` }}>
          <div className="timer-face">
            <p>{active ? modeLabel[active.mode] : "准备开始"}</p>
            <strong>{active ? formatTime(active.remaining) : `${state.settings.focusMinutes}:00`}</strong>
            <span>{currentTask?.title ?? "从我的任务选择一个任务"}</span>
            {currentTask && <PomodoroProgress actual={currentTask.actualPomodoros} estimate={currentTask.estimatePomodoros} compact />}
          </div>
        </div>

        <div className="timer-controls">
          {active?.pendingSettlement === "pending" ? (
            <div className="settlement-panel">
              <p className="eyebrow">结算当前计时</p>
              <h2>{active.mode === "focus" ? "这个番茄到点了" : "休息到点了"}</h2>
              <p className="muted">
                {active.mode === "focus" ? "先结算，再决定休息或继续。需要补记中断也可以现在补上。" : "结束休息后，可以回到我的任务继续推进。"}
              </p>
              <div className="button-row">
              <button className="primary-button large" onClick={() => void props.finishTimer("completed")}>
                <Check size={18} />
                {active.mode === "focus" ? "记录完成" : "结束休息"}
              </button>
              <button className="secondary-button large" onClick={() => void props.finishTimer("aborted")}>
                <Square size={18} />
                作废
              </button>
              {active.mode === "focus" && (
                <>
                  <button className="secondary-button large" onClick={() => props.addInterruption("internal", "defer")}>
                    补记内部中断
                  </button>
                  <button className="secondary-button large" onClick={() => props.addInterruption("external", "inbox")}>
                    补记外部中断
                  </button>
                </>
              )}
              </div>
            </div>
          ) : !active ? (
            <button
              className="primary-button large"
              onClick={() => void props.beginTimer("focus", currentTask?.id ?? committedTasks[0]?.id)}
              disabled={!currentTask && committedTasks.length === 0}
            >
              <CirclePlay size={18} />
              开始工作
            </button>
          ) : (
            <>
              <button className="primary-button large" onClick={props.toggleTimer}>
                {active.isRunning ? <Pause size={18} /> : <Play size={18} />}
                {active.isRunning ? "暂停" : "继续"}
              </button>
              <button className="secondary-button large" onClick={props.resetTimer}>
                <RotateCcw size={18} />
                重置
              </button>
              <button className="secondary-button large" onClick={() => void props.finishTimer("aborted")}>
                <Square size={18} />
                作废
              </button>
            </>
          )}
        </div>

        <div className="mode-switcher">
          <button onClick={() => void props.beginTimer("short_break")}>
            <CirclePause size={16} />
            短休息
          </button>
          <button onClick={() => void props.beginTimer(upcomingBreakMode)}>
            <Leaf size={16} />
            阶段休息
          </button>
          {active?.mode === "focus" && active.pendingSettlement !== "pending" && (
            <button onClick={() => void props.finishTimer("completed")}>
              <Check size={16} />
              完成一段工作
            </button>
          )}
        </div>
      </section>

      <aside className="focus-side">
        <section className="band now-task">
          <div className="section-title">
            <div>
              <p className="eyebrow">当前工作</p>
              <h2>当下清单</h2>
            </div>
            <Target size={20} />
          </div>
          {currentTask ? (
            <>
              <strong>{currentTask.title}</strong>
              <p>{currentTask.notes || "番茄期间只做这一件事。"}</p>
              <PomodoroProgress actual={currentTask.actualPomodoros} estimate={currentTask.estimatePomodoros} />
              <div className="task-meta">
                <span>{currentTask.project}</span>
              </div>
              <button className="small-button" onClick={() => props.completeTask(currentTask.id)}>
                <Check size={15} />
                提交验收
              </button>
            </>
          ) : (
            <p className="empty">工作队列为空，先去我的任务选择任务。</p>
          )}
        </section>

        <section className="band strict-card">
          <div className="section-title">
            <div>
              <p className="eyebrow">防分心</p>
              <h2>软严格模式</h2>
            </div>
            <BellOff size={20} />
          </div>
          <p>{activeProfile?.name ?? "未配置屏蔽方案"}</p>
          <div className="chip-row compact">
            {activeProfile?.apps.slice(0, 4).map((app) => (
              <span className="chip filled" key={app}>
                {app}
              </span>
            ))}
          </div>
          <p className="muted">
            浏览器预览只做软记录；Tauri macOS 会检测前台 App/URL，并按强度记录、暂停或作废。
          </p>
          {sessionViolations.map((violation) => (
            <p className="warning-line compact" key={violation.id}>
              {violation.action === "aborted" ? "已作废" : violation.action === "paused" ? "已暂停" : "已记录"}：{violation.matchedValue}
            </p>
          ))}
        </section>

        <section className="band interruption-box">
          <div className="section-title">
            <div>
              <p className="eyebrow">中断记录</p>
              <h2>中断记录</h2>
            </div>
            <Activity size={20} />
          </div>
          <input
            value={quickNote}
            onChange={(event) => setQuickNote(event.target.value)}
            placeholder="记录突发念头或外部请求"
          />
          <div className="button-row">
            <button className="secondary-button" onClick={() => props.addInterruption("internal", "defer")}>
              内部中断
            </button>
            <button className="secondary-button" onClick={() => props.addInterruption("external", "inbox")}>
              外部中断
            </button>
          </div>
        </section>
      </aside>
    </div>
  );
}

export function MiniTimer(props: {
  state: AppState;
  task?: Task;
  toggleTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  openFocus: () => void;
}) {
  const active = props.state.activeTimer;
  if (!active) return null;
  const progress = 100 - (active.remaining / active.duration) * 100;
  return (
    <aside className="mini-timer-panel" aria-label="迷你计时器">
      <div>
        <p>{active.pendingSettlement === "pending" ? "待结算" : modeLabel[active.mode]}</p>
        <strong>{formatTime(active.remaining)}</strong>
        <span>{props.task?.title ?? "无任务计时"}</span>
        {props.task && <PomodoroProgress actual={props.task.actualPomodoros} estimate={props.task.estimatePomodoros} compact />}
      </div>
      <div className="mini-timer-progress">
        <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </div>
      <div className="mini-timer-actions">
        <button className="icon-button small" title={active.isRunning ? "暂停" : "继续"} onClick={props.toggleTimer}>
          {active.isRunning ? <Pause size={15} /> : <Play size={15} />}
        </button>
        {active.pendingSettlement === "pending" && (
          <button className="icon-button small" title="记录完成" onClick={() => void props.finishTimer("completed")}>
            <Check size={15} />
          </button>
        )}
        {active.pendingSettlement === "pending" && (
          <button className="small-button" onClick={props.openFocus}>
            结算
          </button>
        )}
        <button className="icon-button small danger" title="作废番茄" onClick={() => void props.finishTimer("aborted")}>
          <Square size={15} />
        </button>
      </div>
    </aside>
  );
}

function PomodoroProgress(props: { actual: number; estimate: number; compact?: boolean }) {
  const estimate = Math.max(0, Math.round(props.estimate));
  const actual = Math.max(0, Math.round(props.actual));
  const visibleCount = Math.min(Math.max(estimate, actual, 1), props.compact ? 6 : 8);
  const overflow = Math.max(0, Math.max(estimate, actual) - visibleCount);

  return (
    <div className={props.compact ? "pomodoro-progress compact" : "pomodoro-progress"} aria-label={`已完成 ${actual} 个番茄，估算 ${estimate} 个番茄`}>
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
