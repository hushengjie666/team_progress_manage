import type React from "react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { ChevronRight, Plus } from "lucide-react";
import type { ProjectOverviewCard } from "../../projectOverview";
import type { TaskStatus } from "../../types";

const projectStatusLabels: Record<TaskStatus, string> = {
  pool: "任务池",
  committed: "已安排",
  in_progress: "进行中",
  pending_review: "待验收",
  completed: "已完成",
  split: "已拆分",
  archived: "已归档",
};

const projectStatusOrder: TaskStatus[] = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];

const PROJECT_CARD_LONG_PRESS_MS = 150;
const PROJECT_CARD_MOUSE_DRAG_START_PX = 8;
const PROJECT_CARD_TOUCH_SCROLL_CANCEL_PX = 18;

const projectWorkspaceBadgeLabel = (card: ProjectOverviewCard) => (
  (card.workspaceType ?? "shared") === "private" ? "私人" : `协作 · ${card.workspaceName}`
);

type ProjectCardPressState = {
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

export function ProjectOverviewCardsPanel(props: {
  cards: ProjectOverviewCard[];
  openProjectDetail: (projectId: string) => void;
  openProjectCreate: () => void;
  reorderProjects: (projectIds: string[]) => void;
}) {
  const [projectReorder, setProjectReorder] = useState<{
    draggingProjectId: string;
    order: string[];
  } | null>(null);
  const longPressTimerRef = useRef<number | undefined>(undefined);
  const projectCardBoardRef = useRef<HTMLElement | null>(null);
  const projectCardRectsRef = useRef<Map<string, DOMRect>>(new Map());
  const projectPressRef = useRef<ProjectCardPressState | null>(null);
  const suppressProjectClickRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== undefined) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = undefined;
    }
  };

  const captureProjectCardRects = () => {
    const board = projectCardBoardRef.current;
    if (!board) return;
    const rects = new Map<string, DOMRect>();
    board.querySelectorAll<HTMLElement>("[data-project-card-id]").forEach((element) => {
      const projectId = element.dataset.projectCardId;
      if (projectId) rects.set(projectId, element.getBoundingClientRect());
    });
    projectCardRectsRef.current = rects;
  };

  const activateProjectReorder = (press: ProjectCardPressState) => {
    if (press.active) return;
    press.active = true;
    suppressProjectClickRef.current = true;
    clearLongPressTimer();
    captureProjectCardRects();
    setProjectReorder({ draggingProjectId: press.projectId, order: press.order });
  };

  useEffect(() => () => clearLongPressTimer(), []);

  const projectReorderOrderKey = projectReorder?.order.join("|") ?? "";
  useLayoutEffect(() => {
    const previousRects = projectCardRectsRef.current;
    if (!projectReorder || previousRects.size === 0) return;
    const board = projectCardBoardRef.current;
    if (!board) return;

    board.querySelectorAll<HTMLElement>("[data-project-card-id]").forEach((element) => {
      const projectId = element.dataset.projectCardId;
      if (!projectId || projectId === projectReorder.draggingProjectId) return;
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
    projectCardRectsRef.current = new Map();
  }, [projectReorder?.draggingProjectId, projectReorderOrderKey]);

  const visibleCards = projectReorder
    ? projectReorder.order.map((projectId) => props.cards.find((card) => card.projectId === projectId)).filter((card): card is ProjectOverviewCard => Boolean(card))
    : props.cards;

  const beginProjectPointerDown = (projectId: string, event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    if ((event.target as HTMLElement | null)?.closest("button")) return;
    const order = props.cards.map((card) => card.projectId);
    projectPressRef.current = {
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
      const press = projectPressRef.current;
      if (!press || press.pointerId !== event.pointerId) return;
      activateProjectReorder(press);
    }, PROJECT_CARD_LONG_PRESS_MS);
  };

  const movePressedProject = (event: React.PointerEvent<HTMLElement>) => {
    const press = projectPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    const distance = Math.hypot(event.clientX - press.startX, event.clientY - press.startY);
    if (!press.active) {
      if (press.pointerType === "mouse" && distance > PROJECT_CARD_MOUSE_DRAG_START_PX) {
        activateProjectReorder(press);
      } else if (press.pointerType !== "mouse" && distance > PROJECT_CARD_TOUCH_SCROLL_CANCEL_PX) {
        clearLongPressTimer();
        projectPressRef.current = null;
        return;
      } else {
        return;
      }
    }
    event.preventDefault();
    const target = (document.elementFromPoint(event.clientX, event.clientY) as HTMLElement | null)?.closest<HTMLElement>("[data-project-card-id]");
    const targetProjectId = target?.dataset.projectCardId;
    if (!targetProjectId || targetProjectId === press.projectId) return;
    const nextOrder = moveProjectIdNearTarget(press.order, press.projectId, targetProjectId);
    if (nextOrder === press.order) return;
    captureProjectCardRects();
    press.order = nextOrder;
    press.changed = true;
    setProjectReorder({ draggingProjectId: press.projectId, order: nextOrder });
  };

  const finishProjectPress = (event: React.PointerEvent<HTMLElement>) => {
    const press = projectPressRef.current;
    if (!press || press.pointerId !== event.pointerId) return;
    clearLongPressTimer();
    projectPressRef.current = null;
    if (press.active) {
      if (press.changed) props.reorderProjects(press.order);
      setProjectReorder(null);
      window.setTimeout(() => {
        suppressProjectClickRef.current = false;
      }, 0);
      return;
    }
    suppressProjectClickRef.current = false;
  };

  const cancelProjectPress = () => {
    clearLongPressTimer();
    projectPressRef.current = null;
    setProjectReorder(null);
    suppressProjectClickRef.current = false;
  };

  const shouldSuppressProjectClick = () => suppressProjectClickRef.current || Boolean(projectReorder);

  return (
    <section
      className={projectReorder ? "project-card-board reordering" : "project-card-board"}
      ref={projectCardBoardRef}
      aria-label="项目卡片总览"
    >
      {visibleCards.map((card) => (
        <ProjectOverviewCardItem
          card={card}
          dragging={projectReorder?.draggingProjectId === card.projectId}
          reordering={Boolean(projectReorder)}
          key={card.projectId}
          onPointerCancel={cancelProjectPress}
          onPointerDown={beginProjectPointerDown}
          onPointerMove={movePressedProject}
          onPointerUp={finishProjectPress}
          openProjectDetail={props.openProjectDetail}
          shouldSuppressClick={shouldSuppressProjectClick}
        />
      ))}
      <button className="project-overview-card project-overview-create-card" onClick={props.openProjectCreate} type="button">
        <span className="project-overview-create-icon">
          <Plus size={24} />
        </span>
        <span>
          <strong>新增项目</strong>
          <small>创建私人项目或协作项目</small>
        </span>
      </button>
    </section>
  );
}

function ProjectOverviewCardItem(props: {
  card: ProjectOverviewCard;
  dragging: boolean;
  reordering: boolean;
  onPointerCancel: () => void;
  onPointerDown: (projectId: string, event: React.PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: React.PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: React.PointerEvent<HTMLElement>) => void;
  openProjectDetail: (projectId: string) => void;
  shouldSuppressClick: () => boolean;
}) {
  const { card } = props;
  const hasRisk = card.riskCount > 0;
  const hasPendingReview = card.pendingReviewCount > 0;
  const activeStatuses = projectStatusOrder.filter((status) => card.statusCounts[status] > 0);
  const openProject = () => props.openProjectDetail(card.projectId);
  const cardClassName = [
    "project-overview-card",
    "clickable-card",
    hasRisk || hasPendingReview ? "attention" : "",
    props.reordering ? "reordering" : "",
    props.dragging ? "dragging" : "",
  ].filter(Boolean).join(" ");

  return (
    <article
      aria-label={`进入项目 ${card.name}`}
      className={cardClassName}
      data-project-card-id={card.projectId}
      onClick={(event) => {
        if (props.shouldSuppressClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        openProject();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openProject();
        }
      }}
      onPointerCancel={props.onPointerCancel}
      onPointerDown={(event) => props.onPointerDown(card.projectId, event)}
      onPointerMove={props.onPointerMove}
      onPointerUp={props.onPointerUp}
      tabIndex={0}
    >
      <div className="project-overview-card-header">
        <div>
          <h2 className="project-overview-title-line">
            <span>{card.name}</span>
            {card.workspaceName && (
              <span className="workspace-source-badge">
                {projectWorkspaceBadgeLabel(card)}
              </span>
            )}
          </h2>
          <p>{card.description || "这个项目还没有说明。"}</p>
        </div>
        <div className="project-overview-progress-inline" aria-label={`项目进度 ${card.progressPercent}%`}>
          <strong>{card.progressPercent}%</strong>
          <span>进度</span>
        </div>
      </div>

      <div className="project-overview-meter">
        <span style={{ width: `${Math.max(0, Math.min(100, card.progressPercent))}%` }} />
      </div>

      <div className="project-overview-metrics">
        <div>
          <span>任务</span>
          <strong>{card.taskCount}</strong>
        </div>
        <div>
          <span>成员</span>
          <strong>{card.memberCount}</strong>
        </div>
        <div className={card.riskCount > 0 ? "metric-danger metric-strong" : ""}>
          <span>风险</span>
          <strong>{card.riskCount}</strong>
        </div>
        <div className={card.pendingReviewCount > 0 ? "metric-warning metric-strong" : ""}>
          <span>待验收</span>
          <strong>{card.pendingReviewCount}</strong>
        </div>
      </div>

      <div className="project-status-strip">
        {(activeStatuses.length > 0 ? activeStatuses : ["pool" as TaskStatus]).map((status) => (
          <div className={`project-status-pill status-${status}`} key={status}>
            <span>{projectStatusLabels[status]}</span>
            <strong>{card.statusCounts[status]}</strong>
          </div>
        ))}
      </div>

      <div className="project-overview-signal">
        <span className={card.assignedNotStartedCount > 0 ? "signal-warning" : ""}>
          未开始 {card.assignedNotStartedCount}
        </span>
        <span className={card.activeSessionCount > 0 ? "signal-live" : ""}>
          工作会话 {card.activeSessionCount}
        </span>
      </div>

      <div className="project-overview-actions">
        <button
          className="primary-button"
          onClick={(event) => {
            event.stopPropagation();
            openProject();
          }}
          type="button"
        >
          进入项目
          <ChevronRight size={16} />
        </button>
      </div>
    </article>
  );
}
