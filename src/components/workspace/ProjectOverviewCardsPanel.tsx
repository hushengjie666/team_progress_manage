import { Plus } from "lucide-react";
import type { ProjectOverviewCard } from "../../projectOverview";
import { ProjectOverviewCardItem } from "./ProjectOverviewCardItem";
import { useProjectOverviewCardReorder } from "./useProjectOverviewCardReorder";

export function ProjectOverviewCardsPanel(props: {
  cards: ProjectOverviewCard[];
  openProjectDetail: (projectId: string) => void;
  openProjectCreate: () => void;
  reorderProjects: (projectIds: string[]) => void;
}) {
  const cardReorder = useProjectOverviewCardReorder(props.cards, props.reorderProjects);

  return (
    <section
      className={cardReorder.projectReorder ? "project-card-board reordering" : "project-card-board"}
      ref={cardReorder.projectCardBoardRef}
      aria-label="项目卡片总览"
    >
      {cardReorder.visibleCards.map((card) => (
        <ProjectOverviewCardItem
          card={card}
          dragging={cardReorder.projectReorder?.draggingProjectId === card.projectId}
          reordering={Boolean(cardReorder.projectReorder)}
          key={card.projectId}
          onPointerCancel={cardReorder.cancelProjectPress}
          onPointerDown={cardReorder.beginProjectPointerDown}
          onPointerMove={cardReorder.movePressedProject}
          onPointerUp={cardReorder.finishProjectPress}
          openProjectDetail={props.openProjectDetail}
          shouldSuppressClick={cardReorder.shouldSuppressProjectClick}
        />
      ))}
      <button className="project-overview-card project-overview-create-card" onClick={props.openProjectCreate} type="button">
        <span className="project-overview-create-icon">
          <Plus size={24} />
        </span>
        <span>
          <strong>新增项目</strong>
          <small>创建私人项目或协作项目</small>
        </span>
      </button>
    </section>
  );
}
