import type React from "react";
import { useMemo, useState } from "react";
import type { MyProjectTaskCard } from "../../projectOverview";
import { readStoredMyProjectCardOrder, writeStoredMyProjectCardOrder } from "./myProjectTaskCardOrderStorage";
import {
  orderMyProjectTaskCards,
  visibleMyProjectTaskCards,
} from "./myProjectTaskCardReorderModel";
import { useCardReorderInteraction } from "./useCardReorderInteraction";

export type { MyProjectCardReorderState } from "./myProjectTaskCardReorderModel";

export type MyProjectTaskCardReorderHandlers = {
  beginCardPointerDown: (projectId: string, event: React.PointerEvent<HTMLButtonElement>) => void;
  movePressedCard: (event: React.PointerEvent<HTMLButtonElement>) => void;
  finishCardPress: (event: React.PointerEvent<HTMLButtonElement>) => void;
  cancelCardPress: () => void;
  shouldSuppressCardClick: () => boolean;
};

export function useMyProjectTaskCardReorder(cards: MyProjectTaskCard[]) {
  const [storedOrder, setStoredOrder] = useState<string[]>(() => readStoredMyProjectCardOrder());
  const sortedCards = useMemo(() => orderMyProjectTaskCards(cards, storedOrder), [cards, storedOrder]);
  const cardReorder = useCardReorderInteraction<HTMLDivElement, HTMLButtonElement>({
    itemSelector: "[data-my-project-card-id]",
    getProjectIdFromElement: (element) => element.dataset.myProjectCardId,
    getOrder: () => sortedCards.map((card) => card.projectId),
    onCommit: (order) => {
      setStoredOrder(order);
      writeStoredMyProjectCardOrder(order);
    },
  });
  const visibleCards = useMemo(
    () => visibleMyProjectTaskCards(cards, sortedCards, cardReorder.cardReorder),
    [cards, sortedCards, cardReorder.cardReorder],
  );

  return {
    cardGridRef: cardReorder.containerRef,
    cardReorder: cardReorder.cardReorder,
    visibleCards,
    beginCardPointerDown: cardReorder.beginPointerDown,
    movePressedCard: cardReorder.movePressed,
    finishCardPress: cardReorder.finishPress,
    cancelCardPress: cardReorder.cancelPress,
    shouldSuppressCardClick: cardReorder.shouldSuppressClick,
  };
}
