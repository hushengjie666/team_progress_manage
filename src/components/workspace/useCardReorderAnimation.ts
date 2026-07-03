import { useLayoutEffect, useRef } from "react";
import type { CardReorderState } from "./cardReorderModel";
import { animateReorderFromRects, captureReorderItemRects } from "./cardReorderDomAnimation";

export function useCardReorderAnimation<ContainerElement extends HTMLElement>({
  cardReorder,
  itemSelector,
  getProjectIdFromElement,
}: {
  cardReorder: CardReorderState;
  itemSelector: string;
  getProjectIdFromElement: (element: HTMLElement) => string | undefined;
}) {
  const containerRef = useRef<ContainerElement | null>(null);
  const cardRectsRef = useRef<Map<string, DOMRect>>(new Map());

  const captureCardRects = () => {
    const container = containerRef.current;
    if (!container) return;
    cardRectsRef.current = captureReorderItemRects(container, itemSelector, getProjectIdFromElement);
  };

  const cardReorderOrderKey = cardReorder?.order.join("|") ?? "";
  useLayoutEffect(() => {
    const previousRects = cardRectsRef.current;
    if (!cardReorder || previousRects.size === 0) return;
    const container = containerRef.current;
    if (!container) return;

    animateReorderFromRects(container, itemSelector, getProjectIdFromElement, cardReorder.draggingProjectId, previousRects);
    cardRectsRef.current = new Map();
  }, [cardReorder?.draggingProjectId, cardReorderOrderKey]);

  return { containerRef, captureCardRects };
}
