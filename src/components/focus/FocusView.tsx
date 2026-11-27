import type { ReactNode } from "react";
import type { CompleteTask } from "../../appTaskActionsTypes";
import type { AppState, InterruptionAction, InterruptionType, SessionMode, SessionOutcome, Task } from "../../types";
import { FocusDailyQuote } from "./FocusDailyQuote";
import { FocusCurrentTaskPanel } from "./FocusCurrentTaskPanel";
import { FocusTaskList } from "./FocusTaskList";
import { FocusTimerPanel } from "./FocusTimerPanel";
import { buildFocusTaskList, focusCompletionLabel, focusProgressPercent, groupFocusTasksByProject, upcomingBreakMode } from "./focusModel";

export function FocusView(props: {
  state: AppState;
  currentTask?: Task;
  committedTasks: Task[];
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  resetTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
  completeTask: CompleteTask;
  quickTaskButton: ReactNode;
}) {
  const { state, currentTask, committedTasks } = props;
  const active = state.activeTimer;
  const activeTaskId = active?.taskId;
  const todayWorkTasks = buildFocusTaskList(committedTasks);
  const groupedWorkTasks = groupFocusTasksByProject(todayWorkTasks);
  const currentTaskOutsideTodayList = Boolean(currentTask && !todayWorkTasks.some((task) => task.id === currentTask.id));

  return (
    <div className="focus-layout">
      <section className="focus-stage">
        <div className="focus-stage-inner">
          <FocusDailyQuote />
          <FocusCurrentTaskPanel
            currentTask={currentTask}
            outsideTodayList={currentTaskOutsideTodayList}
            completionLabel={currentTask && focusCompletionLabel(state, currentTask)}
            saving={state.backend.pendingResourceKeys?.includes(`task:${currentTask?.id}`) ?? false}
            completeTask={props.completeTask}
          />
          <FocusTimerPanel
            active={active}
            currentTask={active && active.taskId !== currentTask?.id ? undefined : currentTask}
            committedTasks={committedTasks}
            focusMinutes={state.settings.focusMinutes}
            progress={focusProgressPercent(active)}
            upcomingBreakMode={upcomingBreakMode(state)}
            beginTimer={props.beginTimer}
            toggleTimer={props.toggleTimer}
            resetTimer={props.resetTimer}
            finishTimer={props.finishTimer}
            addInterruption={props.addInterruption}
          />
        </div>
      </section>

      <aside className="focus-side">
        <FocusTaskList
          groups={groupedWorkTasks}
          completionLabel={(task) => focusCompletionLabel(state, task)}
          completeTask={props.completeTask}
          pendingResourceKeys={state.backend.pendingResourceKeys}
          taskCount={todayWorkTasks.length}
          activeTaskId={activeTaskId}
          beginTimer={props.beginTimer}
          quickTaskButton={props.quickTaskButton}
          saving={state.backend.pendingResourceKeys?.some((key) => key.startsWith("daily-plan:")) ?? false}
        />
      </aside>
    </div>
  );
}
