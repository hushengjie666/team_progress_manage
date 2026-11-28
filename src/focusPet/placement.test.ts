import { describe, expect, it } from "vitest";
import { placeDock } from "./placement";

describe.each([[390, 844], [1365, 900]])("item dock inside %i × %i", (vw, vh) => {
  it("leaves the pet hit area uncovered at each corner and the centre", () => {
    for (const x of [10, vw / 2 - 37, vw - 84]) for (const y of [10, vh / 2 - 48, vh - 106]) {
      const anchor = { x, y };
      const dock = placeDock(anchor, 74, 96, vw, vh, []);
      expect(anchor).toEqual({ x, y });
      expect(dock.left).toBeGreaterThanOrEqual(10);
      expect(dock.top).toBeGreaterThanOrEqual(10);
      expect(dock.left + dock.width).toBeLessThanOrEqual(vw - 10);
      expect(dock.top + dock.maxHeight).toBeLessThanOrEqual(vh - 10);
      expect(dock.maxHeight).toBeGreaterThanOrEqual(160);
      expect(dock.left + dock.width <= x || dock.left >= x + 74 ||
        dock.top + dock.maxHeight <= y || dock.top >= y + 96).toBe(true);
    }
  });
});
