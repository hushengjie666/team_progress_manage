import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  clampMiniTimerPosition,
  defaultMiniTimerPosition,
  readStoredMiniTimerPosition,
  writeStoredMiniTimerPosition,
  type MiniTimerPosition,
} from "./miniTimerPosition";
import {
  MINI_TIMER_LONG_PRESS_MS,
  createMiniTimerPressState,
  miniTimerPressDistance,
  shouldActivateMiniTimerDrag,
  shouldCancelMiniTimerTouchScroll,
  type MiniTimerPressState,
} from "./miniTimerDragSession";

export function useMiniTimerDrag() {
  const panelRef = useRef<HTMLElement | null>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const pressRef = useRef<MiniTimerPressState | null>(null);
  const hasCustomPositionRef = useRef(false);
  const [position, setPosition] = useState<MiniTimerPosition | null>(() => {
    const storedPosition = readStoredMiniTimerPosition();
    hasCustomPositionRef.current = Boolean(storedPosition);
    return storedPosition;
  });
  const [dragging, setDragging] = useState(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  const positionFromPointer = (press: MiniTimerPressState, clientX: number, clientY: number) => {
    const panel = panelRef.current;
    const width = panel?.offsetWidth ?? 360;
    const height = panel?.offsetHeight ?? 160;
    return clampMiniTimerPosition({ x: clientX - press.offsetX, y: clientY - press.offsetY }, width, height);
  };

  const positionForCurrentPanel = (current: MiniTimerPosition | null) => {
    const panel = panelRef.current;
    if (!panel) return null;
    return hasCustomPositionRef.current && current
      ? clampMiniTimerPosition(current, panel.offsetWidth, panel.offsetHeight)
      : defaultMiniTimerPosition(panel.offsetWidth, panel.offsetHeight);
  };

  const activateDrag = (press: MiniTimerPressState, clientX = press.startX, clientY = press.startY) => {
    if (press.active) return;
    press.active = true;
    clearLongPressTimer();
    setDragging(true);
    setPosition(positionFromPointer(press, clientX, clientY));
  };

  const beginDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const press = createMiniTimerPressState({ event, rect });
    pressRef.current = press;
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Programmatic pointer events used by automation may not support capture.
    }
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      if (pressRef.current?.pointerId === event.pointerId) activateDrag(pressRef.current);
    }, MINI_TIMER_LONG_PRESS_MS);
  };

  const moveDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = miniTimerPressDistance(press, event);
    if (!press.active) {
      if (shouldActivateMiniTimerDrag(press, distance)) {
        activateDrag(press, event.clientX, event.clientY);
      } else if (shouldCancelMiniTimerTouchScroll(press, distance)) {
        clearLongPressTimer();
        pressRef.current = null;
        return;
      } else {
        return;
      }
    }
    event.preventDefault();
    setPosition(positionFromPointer(press, event.clientX, event.clientY));
  };

  const finishDragPress = (event: ReactPointerEvent<HTMLElement>) => {
    const press = pressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    pressRef.current = null;
    setDragging(false);
    if (press.active) {
      const finalPosition = positionFromPointer(press, event.clientX, event.clientY);
      hasCustomPositionRef.current = true;
      setPosition(finalPosition);
      writeStoredMiniTimerPosition(finalPosition);
    }
  };

  const cancelDragPress = () => {
    clearLongPressTimer();
    pressRef.current = null;
    setDragging(false);
  };

  useEffect(() => () => clearLongPressTimer(), []);

  useLayoutEffect(() => {
    setPosition((current) => {
      const next = positionForCurrentPanel(current);
      if (!next) return current;
      if (hasCustomPositionRef.current) writeStoredMiniTimerPosition(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const handleResize = () => {
      const panel = panelRef.current;
      if (!panel) return;
      setPosition((current) => {
        const next = positionForCurrentPanel(current);
        if (!next) return current;
        if (hasCustomPositionRef.current) writeStoredMiniTimerPosition(next);
        return next;
      });
    };
    window.addEventListener("resize", handleResize);
    handleResize();
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return {
    panelRef,
    position,
    dragging,
    beginDragPress,
    moveDragPress,
    finishDragPress,
    cancelDragPress,
  };
}
