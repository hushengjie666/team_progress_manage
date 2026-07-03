import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";
import { CalendarView } from "./CalendarView";

type AppCalendarRouteProps = Pick<
  AppAuthenticatedShellProps,
  "view" | "shellState" | "settingsActions" | "taskActions"
>;

export function AppCalendarRoute({ view, shellState, settingsActions, taskActions }: AppCalendarRouteProps) {
  const { state } = view;
  const { setSelectedTaskId, setTab } = shellState;

  return (
    <CalendarView
      state={state}
      mode={state.settings.calendarViewMode ?? "week"}
      setMode={(mode) => settingsActions.updateSettings("calendarViewMode", mode)}
      instantiateTaskTemplate={taskActions.instantiateTaskTemplate}
      saveTaskTemplate={taskActions.saveTaskTemplate}
      deleteTaskTemplate={taskActions.deleteTaskTemplate}
      scheduleTaskForDate={taskActions.scheduleTaskForDate}
      openTask={(taskId) => {
        setSelectedTaskId(taskId);
        setTab("workspace");
      }}
    />
  );
}
