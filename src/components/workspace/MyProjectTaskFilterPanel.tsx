import type React from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MyProjectTaskCard } from "../../projectOverview";

const MY_PROJECT_CARD_ORDER_STORAGE_KEY = "timemanage.myProjectTaskCardOrder.v1";
const MY_PROJECT_CARD_LONG_PRESS_MS = 150;
const MY_PROJECT_CARD_MOUSE_DRAG_START_PX = 8;
const MY_PROJECT_CARD_TOUCH_SCROLL_CANCEL_PX = 18;

type MyProjectCardPressState = {
  projectId: string;
  pointerId: number;
  pointerType: string;
  startX: number;
  startY: number;
  active: boolean;
  changed: boolean;
  order: string[];
};

const moveProjectIdNearTarget = (order: string[], draggingProjectId: string, targetProjectId: string) => {
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

const readStoredMyProjectCardOrder = () => {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MY_PROJECT_CARD_ORDER_STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const seen = new Set<string>();
    return parsed.filter((projectId): projectId is string => {
      if (typeof projectId !== "string" || projectId.length === 0 || seen.has(projectId)) return false;
      seen.add(projectId);
      return true;
    });
  } catch {
    return [];
  }
};

const writeStoredMyProjectCardOrder = (projectIds: string[]) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MY_PROJECT_CARD_ORDER_STORAGE_KEY, JSON.stringify(projectIds));
  } catch {
    // localStorage may be disabled by the browser; sorting still works for the current page session.
  }
};

const orderMyProjectTaskCards = (cards: MyProjectTaskCard[], storedOrder: string[]) => {
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

export function MyProjectTaskFilterPanel(props: {
  cards: MyProjectTaskCard[];
  selectedProjectIds: string[];
  toggleProject: (projectId: string) => void;
}) {
  const [storedOrder, setStoredOrder] = useState<string[]>(() => readStoredMyProjectCardOrder());
  const [cardReorder, setCardReorder] = useState<{
    draggingProjectId: string;
    order: string[];
  } | null>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const cardGridRef = useRef<HTMLDivElement | null>(null);
  const cardRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const cardPressRef = useRef<MyProjectCardPressState | null>(null);
  const suppressCardClickRef = useRef(false);
  const selectedSet = useMemo(() => new Set(props.selectedProjectIds), [props.selectedProjectIds]);
  const sortedCards = useMemo(() => orderMyProjectTaskCards(props.cards, storedOrder), [props.cards, storedOrder]);
  const visibleCards = useMemo(() => {
    if (!cardReorder) return sortedCards;
    const cardsById = new Map(props.cards.map((card) => [card.projectId, card]));
    return cardReorder.order.map((projectId) => cardsById.get(projectId)).filter((card): card is MyProjectTaskCard => Boolean(card));
  }, [cardReorder, props.cards, sortedCards]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  const captureCardRects = () => {
    const grid = cardGridRef.current;
    if (!grid) return;
    const rects = new Map<string, DOMRect>();
    grid.querySelectorAll<HTMLElement>("[data-my-project-card-id]").forEach((element) => {
      const projectId = element.dataset.myProjectCardId;
      if (projectId) rects.set(projectId, element.getBoundingClientRect());
    });
    cardRectsRef.current = rects;
  };

  const activateCardReorder = (press: MyProjectCardPressState) => {
    if (press.active) return;
    press.active = true;
    suppressCardClickRef.current = true;
    clearLongPressTimer();
    captureCardRects();
    setCardReorder({ draggingProjectId: press.projectId, order: press.order });
  };

  useEffect(() => () => clearLongPressTimer(), []);

  const cardReorderOrderKey = cardReorder?.order.join("|") ?? "";
  useLayoutEffect(() => {
    const previousRects = cardRectsRef.current;
    if (!cardReorder || previousRects.size === 0) return;
    const grid = cardGridRef.current;
    if (!grid) return;

    grid.querySelectorAll<HTMLElement>("[data-my-project-card-id]").forEach((element) => {
      const projectId = element.dataset.myProjectCardId;
      if (!projectId || projectId === cardReorder.draggingProjectId) return;
      const previous = previousRects.get(projectId);
      if (!previous) return;
      const next = element.getBoundingClientRect();
      const dx = previous.left - next.left;
      const dy = previous.top - next.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) return;
      element.getAnimations().forEach((animation) => animation.cancel());
      element.animate(
        [
          { transform: `translate(${dx}px, ${dy}px)` },
          { transform: "translate(0, 0)" },
        ],
        {
          duration: 190,
          easing: "cubic-bezier(0.22, 1, 0.36, 1)",
        },
      );
    });
    cardRectsRef.current = new Map();
  }, [cardReorder?.draggingProjectId, cardReorderOrderKey]);

  const beginCardPointerDown = (projectId: string, event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    const order = sortedCards.map((card) => card.projectId);
    cardPressRef.current = {
      projectId,
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startX: event.clientX,
      startY: event.clientY,
      active: false,
      changed: false,
      order,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      const press = cardPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      activateCardReorder(press);
    }, MY_PROJECT_CARD_LONG_PRESS_MS);
  };

  const movePressedCard = (event: React.PointerEvent<HTMLButtonElement>) => {
    const press = cardPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (!press.active) {
      if (press.pointerType === "mouse" && distance > MY_PROJECT_CARD_MOUSE_DRAG_START_PX) {
        activateCardReorder(press);
      } else if (press.pointerType !== "mouse" && distance > MY_PROJECT_CARD_TOUCH_SCROLL_CANCEL_PX) {
        clearLongPressTimer();
        cardPressRef.current = null;
        return;
      } else {
        return;
      }
    }
    event.preventDefault();
    const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-my-project-card-id]");
    const targetProjectId = target?.dataset.myProjectCardId;
    if (!targetProjectId || targetProjectId === press.projectId) return;
    const nextOrder = moveProjectIdNearTarget(press.order, press.projectId, targetProjectId);
    if (nextOrder === press.order) return;
    captureCardRects();
    press.order = nextOrder;
    press.changed = true;
    setCardReorder({ draggingProjectId: press.projectId, order: nextOrder });
  };

  const finishCardPress = (event: React.PointerEvent<HTMLButtonElement>) => {
    const press = cardPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    cardPressRef.current = null;
    if (press.active) {
      if (press.changed) {
        setStoredOrder(press.order);
        writeStoredMyProjectCardOrder(press.order);
      }
      setCardReorder(null);
      window.setTimeout(() => {
        suppressCardClickRef.current = false;
      }, 0);
      return;
    }
    suppressCardClickRef.current = false;
  };

  const cancelCardPress = () => {
    clearLongPressTimer();
    cardPressRef.current = null;
    setCardReorder(null);
    suppressCardClickRef.current = false;
  };

  const shouldSuppressCardClick = () => suppressCardClickRef.current || Boolean(cardReorder);

  return (
    <section className="band personal-workbench my-project-task-panel">
      <div className={cardReorder ? "my-project-card-grid reordering" : "my-project-card-grid"} ref={cardGridRef}>
        {props.cards.length === 0 && <p className="empty">当前成员还没有绑定项目。</p>}
        {visibleCards.map((card) => {
          const selected = selectedSet.has(card.projectId);
          const workspaceLabel = card.workspaceName ?? "未归属工作区";
          const cardClassName = [
            "my-project-task-card",
            selected ? "selected" : "",
            cardReorder ? "reordering" : "",
            cardReorder?.draggingProjectId === card.projectId ? "dragging" : "",
          ].filter(Boolean).join(" ");
          return (
            <button
              className={cardClassName}
              data-my-project-card-id={card.projectId}
              key={card.projectId}
              onClick={(event) => {
                if (shouldSuppressCardClick()) {
                  event.preventDefault();
                  event.stopPropagation();
                  return;
                }
                props.toggleProject(card.projectId);
              }}
              onPointerCancel={cancelCardPress}
              onPointerDown={(event) => beginCardPointerDown(card.projectId, event)}
              onPointerMove={movePressedCard}
              onPointerUp={finishCardPress}
              type="button"
              aria-pressed={selected}
            >
              <div className="my-project-card-main">
                <div>
                  <p className="eyebrow">{workspaceLabel}</p>
                  <h2>{card.name}</h2>
                </div>
                <div className="my-project-progress" aria-label={`项目进度 ${card.progressPercent}%`}>
                  <strong>{card.progressPercent}%</strong>
                </div>
              </div>
              <div className="my-project-mini-meter">
                <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
              </div>
              <div className="my-project-mini-metrics">
                <span>任务 {card.myTaskCount}</span>
                <span>进行中 {card.inProgressCount}</span>
                <span>待验收 {card.pendingReviewCount}</span>
                <span>池 {card.poolCount}</span>
                <span>安排 {card.committedCount}</span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
