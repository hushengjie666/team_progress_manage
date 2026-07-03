import { ReportsView } from "./ReportsView";
import type { AppAuthenticatedShellProps } from "./AppAuthenticatedShellTypes";

type AppReportsRouteProps = Pick<AppAuthenticatedShellProps, "view" | "shellState" | "settingsActions">;

export function AppReportsRoute({ view, shellState, settingsActions }: AppReportsRouteProps) {
  const { state } = view;
  const { setTab, setSelectedTaskId } = shellState;

  return (
    <ReportsView
      state={state}
      onNavigate={setTab}
      updateReportFilter={settingsActions.updateReportFilter}
      onOpenTask={(taskId) => {
        setSelectedTaskId(taskId);
        setTab("workspace");
      }}
      onFilterProject={(project) =>
        settingsActions.updateReportFilter({
          ...(state.settings.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" }),
          project,
        })
      }
      onFilterTag={(tag) =>
        settingsActions.updateReportFilter({
          ...(state.settings.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" }),
          tag,
        })
      }
    />
  );
}
