export const CARD_LONG_PRESS_MS = 150;

const CARD_MOUSE_DRAG_START_PX = 8;
const CARD_TOUCH_SCROLL_CANCEL_PX = 18;

export type CardPressState = {
  projectId: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
  changed: boolean;
  order: string[];
};

type CardPointerEventSnapshot = {
  pointerId: number;
  pointerType: string;
  clientX: number;
  clientY: number;
};

export const createCardPressState = ({
  projectId,
  event,
  order,
}: {
  projectId: string;
  event: CardPointerEventSnapshot;
  order: string[];
}): CardPressState => ({
  projectId,
  pointerId: event.pointerId,
  pointerType: event.pointerType,
  startX: event.clientX,
  startY: event.clientY,
  active: false,
  changed: false,
  order,
});

export const cardPressMoveDistance = (press: CardPressState, event: CardPointerEventSnapshot) =>
  Math.hypot(event.clientX - press.startX, event.clientY - press.startY);

export const shouldActivateCardDrag = (press: CardPressState, distance: number) =>
  press.pointerType === "mouse" && distance > CARD_MOUSE_DRAG_START_PX;

export const shouldCancelTouchScroll = (press: CardPressState, distance: number) =>
  press.pointerType !== "mouse" && distance > CARD_TOUCH_SCROLL_CANCEL_PX;
