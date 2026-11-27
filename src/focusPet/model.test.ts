import { describe, expect, it } from "vitest";
import type { ActiveTimer } from "../types";
import { withoutAccountOwnedSettings } from "../accountSettingKeys";
import { foods, outfits } from "./catalog";
import { act, condition, credit, DAY, emptyPet } from "./model";
import { petCacheKey } from "./store";

const start = new Date(2026, 5, 2, 9).getTime();
const iso = (ms: number) => new Date(ms).toISOString();
const adopted = () => act(emptyPet(), { kind: "adopt", species: "cat", name: " 花花 " }, start);
const timer: ActiveTimer = { sessionId: "one", mode: "focus", startedAt: iso(start), duration: 1500, remaining: 1500,
  plannedEndAt: iso(start + 1_500_000), isRunning: true, totalPausedSeconds: 0, cycleIndex: 1 };

describe("专注金币", () => {
  it("preserves partial minutes, ignores already credited time after refresh, pause and breaks", () => {
    const first = credit(adopted(), timer, start + 39_700);
    expect([first.coins, first.remainder]).toEqual([0, 39700]);
    const pause = { ...timer, isRunning: false, remaining: 1459, pausedAt: iso(start + 41_000) };
    const paused = credit(first, pause, start + 51_000);
    expect(paused.remainder).toBe(41000);
    const resumed = { ...timer, totalPausedSeconds: 10, plannedEndAt: iso(start + 1_510_000) };
    const next = credit(paused, resumed, start + 70_000);
    expect([next.coins, next.remainder, next.earned]).toEqual([1, 0, 1]);
    for (const mode of ["short_break", "long_break"] as const) {
      expect(credit(next, { ...timer, mode }, start + 200_000)).toBe(next);
    }
    expect(credit(next, resumed, start + 68_000)).toBe(next);
    const restored = JSON.parse(JSON.stringify(next));
    expect(credit(restored, resumed, start + 70_000)).toBe(restored);
  });
  it("bounds earnings by real duration, new pet birth, valid timestamps and expiry", () => {
    const fast = { ...timer, speedMultiplier: 100, plannedEndAt: iso(start + 15_000) };
    expect(credit(adopted(), fast, start + DAY).remainder).toBe(15_000);
    expect(credit(adopted(), timer, start + DAY).coins).toBe(25);
    expect(credit(adopted(), { ...timer, startedAt: "bad" }, start + 1000).coins).toBe(0);
    expect(credit(adopted(), timer, NaN).remainder).toBe(0);
    const bornLater = act(emptyPet(), { kind: "adopt", species: "shiba", name: "小满" }, start + 10_000);
    expect(credit(bornLater, timer, start + 65_000).remainder).toBe(55_000);
    const later = start + 3 * DAY + 1000;
    expect(credit(adopted(), { ...timer, startedAt: iso(later), plannedEndAt: iso(later + 1500_000) }, later + 60_000).coins).toBe(0);
  });
  it("excludes fractional pause time and rejects pre-pause observations from a stale device", () => {
    const before = credit(adopted(), timer, start + 30_000);
    const paused = credit(before, { ...timer, remaining: 1470, isRunning: false, pausedAt: iso(start + 30_000) }, start + 30_000);
    expect(credit(paused, timer, start + 31_000)).toBe(paused);
    const resumed = { ...timer, plannedEndAt: iso(start + 1_500_420) };
    const almost = credit(paused, resumed, start + 60_100);
    expect([almost.coins, almost.remainder]).toEqual([0, 59_680]);
    expect(credit(almost, resumed, start + 60_420).coins).toBe(1);
  });
  it("assigns credits on either side of local midnight to the correct day", () => {
    const midnight = new Date(2026, 5, 3).getTime();
    const night = { ...timer, startedAt: iso(midnight - 90_000), plannedEndAt: iso(midnight + 300_000) };
    const next = credit(adopted(), night, midnight + 30_000);
    expect([next.coins, next.earned]).toEqual([2, 1]);
  });
});

describe("宠物照料", () => {
  it("locates starvation and death offline, including the strict 48h boundary", () => {
    const s = adopted();
    expect(condition(s, start + DAY / 2).fullness).toBe(50);
    expect(condition(s, start + DAY).fullness).toBe(0);
    expect(condition(s, start + 1.25 * DAY).left).toBe(42 * 3_600_000);
    for (const hours of [47.9, 48, 48.1]) expect(condition(s, start + DAY + hours * 3_600_000).dead).toBe(hours > 48);
    const saved = act({ ...s, bag: { berry: 1 } }, { kind: "feed", food: "berry" }, start + 3 * DAY);
    expect(condition(saved, start + 3 * DAY).fullness).toBe(10);
    expect(condition(saved, start).fullness).toBe(10);
    expect(condition(saved, start + 3.1 * DAY).left).toBe(2 * DAY);
  });
  it("keeps food prices proportional and prevents wasted or unaffordable purchases", () => {
    for (const food of foods) {
      const s = { ...adopted(), coins: food.price };
      const buy = { kind: "buyFood" as const, food: food.id, serve: true };
      expect(food.price).toBe(2.4 * food.points);
      expect(act(s, buy, start)).toBe(s);
      const stored = act(s, { ...buy, serve: false }, start);
      expect(stored.bag[food.id]).toBe(1);
      expect(act(stored, buy, start + DAY)).toBe(stored);
      const fed = act(stored, { kind: "feed", food: food.id }, start + DAY);
      expect(condition(fed, start + DAY).fullness).toBe(food.points);
      expect(fed.bag[food.id]).toBe(0);
    }
  });
  it("inherits all three slots on readoption, clearing money, inventory and worn layers", () => {
    let s = { ...adopted(), coins: 9000 };
    for (const item of outfits) {
      const buy = { kind: "buyOutfit" as const, outfit: item.id };
      s = act(s, buy, start);
      expect(act(s, buy, start)).toBe(s);
      s = act(s, { kind: "wear", outfit: item.id }, start);
      expect(s.wearing[item.slot]).toBe(item.id);
    }
    s = act(s, { kind: "buyFood", food: "berry", serve: false }, start);
    const later = start + 3 * DAY + 1;
    expect(act(s, { kind: "feed", food: "berry" }, later)).toBe(s);
    const next = act(s, { kind: "adopt", species: "penguin", name: "星星" }, later);
    expect(next).toMatchObject({ coins: 0, bag: {}, wearing: {}, past: 1, longest: 3, remainder: 0, wardrobe: s.wardrobe });
    expect(condition(next, later)).toMatchObject({ days: 0, fullness: 100 });
    expect(act(next, { kind: "wear", outfit: "leaf" }, later).wearing.head).toBe("leaf");
  });
  it("isolates caches by account and server and excludes pet state from shared runtime settings", () => {
    expect(petCacheKey("https://example.test/", "a")).toBe(petCacheKey("https://example.test", "a"));
    expect(new Set([petCacheKey("x", "1"), petCacheKey("x", "2"), petCacheKey("y", "1")]).size).toBe(3);
    expect(withoutAccountOwnedSettings({ dailyQuotes: {}, focusPet: adopted(), focusMinutes: 10 })).toEqual({ focusMinutes: 10 });
  });
});
