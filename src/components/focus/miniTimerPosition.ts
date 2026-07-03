export type MiniTimerPosition = {
  x: number;
  y: number;
};

const MINI_TIMER_POSITION_STORAGE_KEY = "timemanage.miniTimerPosition.v1";
export const MINI_TIMER_EDGE_GAP = 10;

export const parseMiniTimerPosition = (value: unknown): MiniTimerPosition | null => {
  if (!value || typeof value !== "object") return null;
  const position = value as Partial<MiniTimerPosition>;
  return Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: position.x!, y: position.y! }
    : null;
};

export const readStoredMiniTimerPosition = (): MiniTimerPosition | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(MINI_TIMER_POSITION_STORAGE_KEY);
    return raw ? parseMiniTimerPosition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeStoredMiniTimerPosition = (position: MiniTimerPosition) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(MINI_TIMER_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // Dragging should still work for the current session when localStorage is unavailable.
  }
};

export const clampMiniTimerPosition = (
  position: MiniTimerPosition,
  width: number,
  height: number,
  viewportWidth = typeof window === "undefined" ? undefined : window.innerWidth,
  viewportHeight = typeof window === "undefined" ? undefined : window.innerHeight,
): MiniTimerPosition => {
  if (!viewportWidth || !viewportHeight) return position;
  const maxX = Math.max(MINI_TIMER_EDGE_GAP, viewportWidth - width - MINI_TIMER_EDGE_GAP);
  const maxY = Math.max(MINI_TIMER_EDGE_GAP, viewportHeight - height - MINI_TIMER_EDGE_GAP);
  return {
    x: Math.min(Math.max(MINI_TIMER_EDGE_GAP, position.x), maxX),
    y: Math.min(Math.max(MINI_TIMER_EDGE_GAP, position.y), maxY),
  };
};
