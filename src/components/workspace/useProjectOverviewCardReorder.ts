import type { ProjectOverviewCard } from "../../projectOverview";
import { visibleCardsForReorder } from "./cardReorderModel";
import { useCardReorderInteraction } from "./useCardReorderInteraction";

export function useProjectOverviewCardReorder(
  cards: ProjectOverviewCard[],
  reorderProjects: (projectIds: string[]) => void,
) {
  const cardReorder = useCardReorderInteraction<HTMLElement, HTMLElement>({
    itemSelector: "[data-project-card-id]",
    getProjectIdFromElement: (element) => element.dataset.projectCardId,
    getOrder: () => cards.map((card) => card.projectId),
    onCommit: reorderProjects,
    shouldIgnorePointerDown: (event) => Boolean((event.target as HTMLElement | null)?.closest("button")),
  });

  return {
    projectCardBoardRef: cardReorder.containerRef,
    projectReorder: cardReorder.cardReorder,
    visibleCards: visibleCardsForReorder(cards, cards, cardReorder.cardReorder),
    beginProjectPointerDown: cardReorder.beginPointerDown,
    movePressedProject: cardReorder.movePressed,
    finishProjectPress: cardReorder.finishPress,
    cancelProjectPress: cardReorder.cancelPress,
    shouldSuppressProjectClick: cardReorder.shouldSuppressClick,
  };
}
