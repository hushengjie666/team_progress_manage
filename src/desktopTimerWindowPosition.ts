export type DesktopTimerWindowPosition = {
  x: number;
  y: number;
};

export type DesktopTimerWorkArea = {
  position: DesktopTimerWindowPosition;
  size: {
    width: number;
    height: number;
  };
};

const DESKTOP_TIMER_POSITION_STORAGE_KEY = "timemanage.desktopTimerWindowPosition.v1";
export const DESKTOP_TIMER_EDGE_GAP = 24;

export const parseDesktopTimerWindowPosition = (value: unknown): DesktopTimerWindowPosition | null => {
  if (!value || typeof value !== "object") return null;
  const position = value as Partial<DesktopTimerWindowPosition>;
  return Number.isFinite(position.x) && Number.isFinite(position.y)
    ? { x: position.x!, y: position.y! }
    : null;
};

export const readStoredDesktopTimerWindowPosition = (): DesktopTimerWindowPosition | null => {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DESKTOP_TIMER_POSITION_STORAGE_KEY);
    return raw ? parseDesktopTimerWindowPosition(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};

export const writeStoredDesktopTimerWindowPosition = (position: DesktopTimerWindowPosition) => {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(DESKTOP_TIMER_POSITION_STORAGE_KEY, JSON.stringify(position));
  } catch {
    // The overlay can still be dragged for the current session when localStorage is unavailable.
  }
};

export const defaultDesktopTimerWindowPosition = (
  width: number,
  height: number,
  workArea: DesktopTimerWorkArea,
): DesktopTimerWindowPosition => ({
  x: workArea.position.x + Math.max(DESKTOP_TIMER_EDGE_GAP, workArea.size.width - width - DESKTOP_TIMER_EDGE_GAP),
  y: workArea.position.y + Math.max(DESKTOP_TIMER_EDGE_GAP, workArea.size.height - height - DESKTOP_TIMER_EDGE_GAP),
});

export const clampDesktopTimerWindowPosition = (
  position: DesktopTimerWindowPosition,
  width: number,
  height: number,
  workArea: DesktopTimerWorkArea,
): DesktopTimerWindowPosition => {
  const minX = workArea.position.x + DESKTOP_TIMER_EDGE_GAP;
  const minY = workArea.position.y + DESKTOP_TIMER_EDGE_GAP;
  const maxX = workArea.position.x + Math.max(DESKTOP_TIMER_EDGE_GAP, workArea.size.width - width - DESKTOP_TIMER_EDGE_GAP);
  const maxY = workArea.position.y + Math.max(DESKTOP_TIMER_EDGE_GAP, workArea.size.height - height - DESKTOP_TIMER_EDGE_GAP);
  return {
    x: Math.min(Math.max(minX, position.x), maxX),
    y: Math.min(Math.max(minY, position.y), maxY),
  };
};

export const resolveDesktopTimerWindowPosition = (
  storedPosition: DesktopTimerWindowPosition | null,
  width: number,
  height: number,
  workArea: DesktopTimerWorkArea,
) => clampDesktopTimerWindowPosition(
  storedPosition ?? defaultDesktopTimerWindowPosition(width, height, workArea),
  width,
  height,
  workArea,
);
