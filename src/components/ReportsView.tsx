import type { Tab } from "../appModel";
import { buildReportsViewModel } from "../reportsViewModel";
import type { AppState, ReportFilter } from "../types";
import { ReportDistributionPanel } from "./reports/ReportDistributionPanel";
import { ReportEstimatePanel, ReportHotspotPanel } from "./reports/ReportFeedbackPanels";
import { ReportFilterPanel } from "./reports/ReportFilterPanel";
import {
  ReportInsightPanel,
  ReportMetricSummary,
  ReportNextActionPanel,
  ReportRewardPanel,
} from "./reports/ReportSummaryPanels";
import { ReportTimelinePanel } from "./reports/ReportTimelinePanel";
import { ReportHeatmapPanel, ReportTrendPanel } from "./reports/ReportTrendPanels";

export function ReportsView({
  state,
  onNavigate,
  updateReportFilter,
  onOpenTask,
  onFilterProject,
  onFilterTag,
}: {
  state: AppState;
  onNavigate: (tab: Tab) => void;
  updateReportFilter: (filter: ReportFilter) => void;
  onOpenTask: (taskId: string) => void;
  onFilterProject?: (project: string) => void;
  onFilterTag?: (tag: string) => void;
}) {
  const report = buildReportsViewModel(state);

  return (
    <div className="reports-layout">
      <ReportMetricSummary report={report} />

      <ReportFilterPanel
        filter={report.filter}
        summary={report.summary}
        projects={report.projects}
        tags={report.tags}
        tasks={state.tasks}
        updateReportFilter={updateReportFilter}
      />

      <ReportRewardPanel report={report} />
      <ReportNextActionPanel report={report} onNavigate={onNavigate} />
      <ReportInsightPanel report={report} />
      <ReportTrendPanel report={report} />
      <ReportHeatmapPanel report={report} />
      <ReportEstimatePanel report={report} onOpenTask={onOpenTask} />
      <ReportHotspotPanel report={report} />
      <ReportDistributionPanel report={report} onFilterProject={onFilterProject} onFilterTag={onFilterTag} />

      <ReportTimelinePanel focusSessions={report.reportState.focusSessions} tasks={state.tasks} onOpenTask={onOpenTask} />
    </div>
  );
}
