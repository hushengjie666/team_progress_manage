import type { ActiveTimer, AppState, InterruptionAction, InterruptionType, SessionMode, SessionOutcome, Task } from "../../types";
import { FocusCurrentTaskPanel } from "./FocusCurrentTaskPanel";
import { FocusTaskList } from "./FocusTaskList";
import { FocusTimerPanel } from "./FocusTimerPanel";
import { buildFocusTaskList, focusProgressPercent, groupFocusTasksByProject, upcomingBreakMode } from "./focusModel";

export function FocusView(props: {
  state: AppState;
  activeTimer?: ActiveTimer;
  currentTask?: Task;
  committedTasks: Task[];
  beginTimer: (mode: SessionMode, taskId?: string) => Promise<void>;
  toggleTimer: () => void;
  resetTimer: () => void;
  finishTimer: (outcome: SessionOutcome) => Promise<void>;
  addInterruption: (type: InterruptionType, action?: InterruptionAction) => void;
  completeTask: (taskId: string) => void;
}) {
  const { state, currentTask, committedTasks } = props;
  const active = props.activeTimer;
  const activeTaskId = active?.taskId;
  const todayWorkTasks = buildFocusTaskList(currentTask, committedTasks, activeTaskId);
  const groupedWorkTasks = groupFocusTasksByProject(todayWorkTasks);

  return (
    <div className="focus-layout">
      <section className="focus-stage">
        <div className="focus-stage-inner">
          <FocusCurrentTaskPanel
            currentTask={currentTask}
            completeTask={props.completeTask}
          />
          <FocusTimerPanel
            active={active}
            currentTask={currentTask}
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
          taskCount={todayWorkTasks.length}
          activeTaskId={activeTaskId}
          beginTimer={props.beginTimer}
        />
      </aside>
    </div>
  );
}
