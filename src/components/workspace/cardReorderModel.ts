export type CardReorderState = {
  draggingProjectId: string;
  order: string[];
} | null;

export const moveProjectIdNearTarget = (order: string[], draggingProjectId: string, targetProjectId: string) => {
  const sourceIndex = order.indexOf(draggingProjectId);
  const targetIndex = order.indexOf(targetProjectId);
  if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return order;
  const withoutSource = order.filter((projectId) => projectId !== draggingProjectId);
  const targetIndexAfterRemoval = withoutSource.indexOf(targetProjectId);
  const insertIndex = sourceIndex < targetIndex ? targetIndexAfterRemoval + 1 : targetIndexAfterRemoval;
  return [
    ...withoutSource.slice(0, insertIndex),
    draggingProjectId,
    ...withoutSource.slice(insertIndex),
  ];
};

export const visibleCardsForReorder = <Card extends { projectId: string }>(
  cards: Card[],
  fallbackCards: Card[],
  cardReorder: CardReorderState,
) => {
  if (!cardReorder) return fallbackCards;
  const cardsById = new Map(cards.map((card) => [card.projectId, card]));
  return cardReorder.order.map((projectId) => cardsById.get(projectId)).filter((card): card is Card => Boolean(card));
};
