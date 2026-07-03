import type { MyProjectTaskCard } from "../../projectOverview";
import {
  visibleCardsForReorder,
  type CardReorderState,
} from "./cardReorderModel";

export type MyProjectCardReorderState = CardReorderState;
export { moveProjectIdNearTarget } from "./cardReorderModel";

export const sanitizeMyProjectCardOrder = (value: unknown) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  return value.filter((projectId): projectId is string => {
    if (typeof projectId !== "string" || projectId.length === 0 || seen.has(projectId)) return false;
    seen.add(projectId);
    return true;
  });
};

export const orderMyProjectTaskCards = (cards: MyProjectTaskCard[], storedOrder: string[]) => {
  const cardsById = new Map(cards.map((card) => [card.projectId, card]));
  const usedProjectIds = new Set<string>();
  const orderedCards: MyProjectTaskCard[] = [];

  storedOrder.forEach((projectId) => {
    const card = cardsById.get(projectId);
    if (!card || usedProjectIds.has(projectId)) return;
    orderedCards.push(card);
    usedProjectIds.add(projectId);
  });

  cards.forEach((card) => {
    if (usedProjectIds.has(card.projectId)) return;
    orderedCards.push(card);
    usedProjectIds.add(card.projectId);
  });

  return orderedCards;
};

export const visibleMyProjectTaskCards = (cards: MyProjectTaskCard[], sortedCards: MyProjectTaskCard[], cardReorder: MyProjectCardReorderState) => {
  return visibleCardsForReorder(cards, sortedCards, cardReorder);
};
