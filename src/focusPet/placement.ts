import { clampMiniTimerPosition } from "../components/focus/miniTimerPosition";
import type { Position } from "./model";

export type Obstacle = Pick<DOMRect, "top" | "bottom" | "left" | "right">;

/** Choose an unobstructed initial spot before the user has positioned the pet. */
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

// Find the tallest available vertical gap at the pet's side or along a control's edge.
export function placeHouse(anchor: Position, vw: number, vh: number, obstacles: Obstacle[], preferredWidth = 402, limit = 552, usableHeight = limit) {
  const width = Math.min(preferredWidth, vw - 20);
  const edge = 10;
  const preferred = anchor.x + 37 - width / 2;
  const candidates = [preferred, edge, vw - width - edge, ...obstacles.flatMap(r => [r.right + 5, r.left - width - 5])];
  let best = { left: edge, top: edge, width, maxHeight: 0 };
  let score = -Infinity;
  for (const candidate of candidates) {
    const left = Math.max(edge, Math.min(candidate, vw - width - edge));
    const blockers = obstacles.filter(r => r.right > left && r.left < left + width).sort((a, b) => a.top - b.top);
    let start = edge;
    for (const end of [...blockers, { top: vh - edge + 5, bottom: vh }]) {
      const height = Math.min(limit, end.top - 5 - start);
      if (height > 0) {
        const top = Math.max(start, Math.min(anchor.y - height / 2, end.top - 5 - height));
        const distance = Math.hypot(left - preferred, top + height / 2 - anchor.y);
        const rank = Math.min(height, usableHeight) * 10 + height * 0.1 - distance * 0.1;
        if (rank > score) { best = { left, top, width, maxHeight: height }; score = rank; }
      }
      start = Math.max(start, end.bottom + 5);
    }
  }
  return best;
}

export function placeDock(anchor: Position, width: number, height: number, vw: number, vh: number, controls: Obstacle[]) {
  const pet = { left: anchor.x, right: anchor.x + width, top: anchor.y, bottom: anchor.y + height };
  const beside = (obstacles: Obstacle[]) => placeHouse(anchor, vw, vh, [pet, ...obstacles], 244, 234, 158);
  const clear = beside(controls);
  return clear.maxHeight >= 160 ? clear : beside([]);
}
