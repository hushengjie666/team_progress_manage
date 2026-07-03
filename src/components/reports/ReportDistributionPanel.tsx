import { SlidersHorizontal } from "lucide-react";
import { DistributionList } from "./ReportPrimitives";
import type { ReportsViewModel } from "./reportPanelTypes";

export function ReportDistributionPanel({
  report,
  onFilterProject,
  onFilterTag,
}: {
  report: ReportsViewModel;
  onFilterProject?: (project: string) => void;
  onFilterTag?: (tag: string) => void;
}) {
  return (
    <section className="band distribution-panel">
      <div className="section-title">
        <div>
          <p className="eyebrow">分布分析</p>
          <h2>项目与标签分布</h2>
        </div>
        <SlidersHorizontal size={20} />
      </div>
      <div className="distribution-grid">
        <DistributionList
          title="项目"
          items={report.projectDistribution}
          max={report.maxDistribution}
          onItemSelect={(project) => onFilterProject?.(project)}
        />
        <DistributionList
          title="标签"
          items={report.tagDistribution}
          max={report.maxDistribution}
          onItemSelect={(tag) => onFilterTag?.(tag)}
        />
      </div>
    </section>
  );
}
