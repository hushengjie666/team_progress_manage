import type React from "react";
import type { ProjectOverviewCard } from "../../projectOverview";
import {
  ProjectOverviewCardActions,
  ProjectOverviewCardHeader,
  ProjectOverviewCardMetrics,
  ProjectOverviewCardProgressMeter,
  ProjectOverviewCardSignals,
  ProjectOverviewCardStatusStrip,
} from "./ProjectOverviewCardParts";

export function ProjectOverviewCardItem(props: {
  card: ProjectOverviewCard;
  dragging: boolean;
  reordering: boolean;
  onPointerCancel: () => void;
  onPointerDown: (projectId: string, event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  openProjectDetail: (projectId: string) => void;
  shouldSuppressClick: () => boolean;
}) {
  const { card } = props;
  const hasRisk = card.riskCount > 0;
  const hasPendingReview = card.pendingReviewCount > 0;
  const openProject = () => props.openProjectDetail(card.projectId);
  const cardClassName = [
    "project-overview-card",
    "clickable-card",
    hasRisk || hasPendingReview ? "attention" : "",
    props.reordering ? "reordering" : "",
    props.dragging ? "dragging" : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      aria-label={`进入项目 ${card.name}`}
      className={cardClassName}
      data-project-card-id={card.projectId}
      onClick={(event) => {
        if (props.shouldSuppressClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        openProject();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      }}
      onPointerCancel={props.onPointerCancel}
      onPointerDown={(event) => props.onPointerDown(card.projectId, event)}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      tabIndex={0}
    >
      <ProjectOverviewCardHeader card={card} />
      <ProjectOverviewCardProgressMeter progressPercent={card.progressPercent} />
      <ProjectOverviewCardMetrics card={card} />
      <ProjectOverviewCardStatusStrip card={card} />
      <ProjectOverviewCardSignals card={card} />
      <ProjectOverviewCardActions openProject={openProject} />
    </article>
  );
}
