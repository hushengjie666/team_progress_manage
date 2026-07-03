import { useMemo } from "react";
import type { MyProjectTaskCard } from "../../projectOverview";
import { MyProjectTaskCardButton } from "./MyProjectTaskCardButton";
import { useMyProjectTaskCardReorder } from "./useMyProjectTaskCardReorder";

export function MyProjectTaskFilterPanel(props: {
  cards: MyProjectTaskCard[];
  selectedProjectIds: string[];
  toggleProject: (projectId: string) => void;
}) {
  const selectedSet = useMemo(() => new Set(props.selectedProjectIds), [props.selectedProjectIds]);
  const cardReorder = useMyProjectTaskCardReorder(props.cards);

  return (
    <section className="band personal-workbench my-project-task-panel">
      <div className={cardReorder.cardReorder ? "my-project-card-grid reordering" : "my-project-card-grid"} ref={cardReorder.cardGridRef}>
        {props.cards.length === 0 && <p className="empty">当前成员还没有绑定项目。</p>}
        {cardReorder.visibleCards.map((card) => (
          <MyProjectTaskCardButton
            key={card.projectId}
            card={card}
            selected={selectedSet.has(card.projectId)}
            cardReorder={cardReorder.cardReorder}
            toggleProject={props.toggleProject}
            beginCardPointerDown={cardReorder.beginCardPointerDown}
            movePressedCard={cardReorder.movePressedCard}
            finishCardPress={cardReorder.finishCardPress}
            cancelCardPress={cardReorder.cancelCardPress}
            shouldSuppressCardClick={cardReorder.shouldSuppressCardClick}
          />
        ))}
      </div>
    </section>
  );
}
