import { clampMiniTimerPosition } from "../components/focus/miniTimerPosition";
import type { Position } from "./model";

export type Obstacle = Pick<DOMRect, "top" | "bottom" | "left" | "right">;

/** Keep the nearest available spot to the saved position when the focus layout changes. */
export function placePet(point: Position, width: number, height: number, vw: number, vh: number, obstacles: Obstacle[]) {
  const clamp = (p: Position) => clampMiniTimerPosition(p, width, height, vw, vh);
  const origin = clamp(point);
  const overlaps = (p: Position, rect: Obstacle) => p.x < rect.right && p.x + width > rect.left &&
    p.y < rect.bottom && p.y + height > rect.top;
  if (!obstacles.some(rect => overlaps(origin, rect))) return origin;
  const xs = [origin.x, 10, vw - width - 10], ys = [origin.y, 10, vh - height - 10];
  for (const rect of obstacles) {
    xs.push(rect.left - width - 5, rect.right + 5);
    ys.push(rect.top - height - 5, rect.bottom + 5);
  }
  let best = origin, nearest = Infinity;
  for (const x of xs) for (const y of ys) {
    const p = clamp({ x, y });
    const distance = Math.hypot(origin.x - p.x, origin.y - p.y);
    if (distance < nearest && !obstacles.some(rect => overlaps(p, rect))) {
      best = p;
      nearest = distance;
    }
  }
  return best;
}
