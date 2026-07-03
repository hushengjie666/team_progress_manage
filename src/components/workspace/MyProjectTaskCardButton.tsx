import type { MyProjectTaskCard } from "../../projectOverview";
import type {
  MyProjectCardReorderState,
  MyProjectTaskCardReorderHandlers,
} from "./useMyProjectTaskCardReorder";

type MyProjectTaskCardButtonProps = MyProjectTaskCardReorderHandlers & {
  card: MyProjectTaskCard;
  selected: boolean;
  cardReorder: MyProjectCardReorderState;
  toggleProject: (projectId: string) => void;
};

export function MyProjectTaskCardButton({
  card,
  selected,
  cardReorder,
  toggleProject,
  beginCardPointerDown,
  movePressedCard,
  finishCardPress,
  cancelCardPress,
  shouldSuppressCardClick,
}: MyProjectTaskCardButtonProps) {
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
      onClick={(event) => {
        if (shouldSuppressCardClick()) {
          event.preventDefault();
          event.stopPropagation();
          return;
        }
        toggleProject(card.projectId);
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
}
