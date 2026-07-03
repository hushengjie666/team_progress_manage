export const MINI_TIMER_LONG_PRESS_MS = 180;

const MINI_TIMER_MOUSE_DRAG_START_PX = 6;
const MINI_TIMER_TOUCH_SCROLL_CANCEL_PX = 16;

export type MiniTimerPressState = {
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  offsetX: number;
  offsetY: number;
  active: boolean;
};

type MiniTimerPointerSnapshot = {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
};

type MiniTimerElementRect = Pick<DOMRect, "left" | "top">;

export const createMiniTimerPressState = ({
  event,
  rect,
}: {
  event: MiniTimerPointerSnapshot;
  rect: MiniTimerElementRect;
}): MiniTimerPressState => ({
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  startX: event.clientX,
  startY: event.clientY,
  offsetX: event.clientX - rect.left,
  offsetY: event.clientY - rect.top,
  active: false,
});

export const miniTimerPressDistance = (press: MiniTimerPressState, event: MiniTimerPointerSnapshot) =>
  Math.hypot(event.clientX - press.startX, event.clientY - press.startY);

export const shouldActivateMiniTimerDrag = (press: MiniTimerPressState, distance: number) =>
  press.pointerType === "mouse" && distance > MINI_TIMER_MOUSE_DRAG_START_PX;

export const shouldCancelMiniTimerTouchScroll = (press: MiniTimerPressState, distance: number) =>
  press.pointerType !== "mouse" && distance > MINI_TIMER_TOUCH_SCROLL_CANCEL_PX;
