import type React from "react";
import { useEffect, useRef, useState } from "react";
import { moveProjectIdNearTarget, type CardReorderState } from "./cardReorderModel";
import {
  CARD_LONG_PRESS_MS,
  cardPressMoveDistance,
  createCardPressState,
  shouldActivateCardDrag,
  shouldCancelTouchScroll,
  type CardPressState,
} from "./cardReorderPointerSession";
import { useCardReorderAnimation } from "./useCardReorderAnimation";

export function useCardReorderInteraction<ContainerElement extends HTMLElement, PressElement extends HTMLElement>({
  itemSelector,
  getProjectIdFromElement,
  getOrder,
  onCommit,
  shouldIgnorePointerDown,
}: {
  itemSelector: string;
  getProjectIdFromElement: (element: HTMLElement) => string | undefined;
  getOrder: () => string[];
  onCommit: (projectIds: string[]) => void;
  shouldIgnorePointerDown?: (event: React.PointerEvent<PressElement>) => boolean;
}) {
  const [cardReorder, setCardReorder] = useState<CardReorderState>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const cardPressRef = useRef<CardPressState | null>(null);
  const suppressCardClickRef = useRef(false);
  const { containerRef, captureCardRects } = useCardReorderAnimation<ContainerElement>({
    cardReorder,
    itemSelector,
    getProjectIdFromElement,
  });

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  const activateCardReorder = (press: CardPressState) => {
    if (press.active) return;
    press.active = true;
    suppressCardClickRef.current = true;
    clearLongPressTimer();
    captureCardRects();
    setCardReorder({ draggingProjectId: press.projectId, order: press.order });
  };

  useEffect(() => () => clearLongPressTimer(), []);

  const beginPointerDown = (projectId: string, event: React.PointerEvent<PressElement>) => {
    if (event.button !== 0 || shouldIgnorePointerDown?.(event)) return;
    cardPressRef.current = createCardPressState({
      projectId,
      event,
      order: getOrder(),
    });
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      const press = cardPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      activateCardReorder(press);
    }, CARD_LONG_PRESS_MS);
  };

  const movePressed = (event: React.PointerEvent<PressElement>) => {
    const press = cardPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = cardPressMoveDistance(press, event);
    if (!press.active) {
      if (shouldActivateCardDrag(press, distance)) {
        activateCardReorder(press);
      } else if (shouldCancelTouchScroll(press, distance)) {
        clearLongPressTimer();
        cardPressRef.current = null;
        return;
      } else {
        return;
      }
    }
    event.preventDefault();
    const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>(itemSelector);
    const targetProjectId = target ? getProjectIdFromElement(target) : undefined;
    if (!targetProjectId || targetProjectId === press.projectId) return;
    const nextOrder = moveProjectIdNearTarget(press.order, press.projectId, targetProjectId);
    if (nextOrder === press.order) return;
    captureCardRects();
    press.order = nextOrder;
    press.changed = true;
    setCardReorder({ draggingProjectId: press.projectId, order: nextOrder });
  };

  const finishPress = (event: React.PointerEvent<PressElement>) => {
    const press = cardPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    cardPressRef.current = null;
    if (press.active) {
      if (press.changed) onCommit(press.order);
      setCardReorder(null);
      window.setTimeout(() => {
        suppressCardClickRef.current = false;
      }, 0);
      return;
    }
    suppressCardClickRef.current = false;
  };

  const cancelPress = () => {
    clearLongPressTimer();
    cardPressRef.current = null;
    setCardReorder(null);
    suppressCardClickRef.current = false;
  };

  const shouldSuppressClick = () => suppressCardClickRef.current || Boolean(cardReorder);

  return {
    containerRef,
    cardReorder,
    beginPointerDown,
    movePressed,
    finishPress,
    cancelPress,
    shouldSuppressClick,
  };
}
