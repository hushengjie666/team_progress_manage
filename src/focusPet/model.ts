import type { ActiveTimer } from "../types";
import { todayKey } from "../seed";
import { foods, outfits, type Species, type Food, type Outfit, type Slot } from "./catalog";

export const DAY = 86_400_000;
const MINUTE = 60_000;
export type Position = { x: number; y: number };
export type Companion = { species: Species; name: string; born: number; hungryAt: number };
export type PetState = {
  revision: number; observedAt: number; pet?: Companion; coins: number; remainder: number;
  earnedDay: string; earned: number; bag: Partial<Record<Food, number>>;
  wardrobe: Outfit[]; wearing: Partial<Record<Slot, Outfit>>;
  past: number; longest: number; position?: Position; compact: boolean;
  cursor?: { session: string; start: number; elapsed: number; through: number; end: number; pausedRemaining?: number };
};

export const emptyPet = (): PetState => ({
  revision: 0, observedAt: 0, coins: 0, remainder: 0, earnedDay: "", earned: 0,
  bag: {}, wardrobe: [], wearing: {}, past: 0, longest: 0, compact: false,
});

export function condition(state: PetState, time: number) {
  const pet = state.pet;
  const now = Math.max(state.observedAt, Number.isFinite(time) ? time : 0);
  const deadline = pet ? pet.hungryAt + 2 * DAY : now;
  const fullness = pet ? Math.min(100, Math.max(0, (pet.hungryAt - now) * 100 / DAY)) : 0;
  const dead = Boolean(pet && now > deadline);
  const days = pet ? Math.floor((Math.min(now, deadline) - pet.born) / DAY) : 0;
  return { now, fullness, days, dead, left: Math.max(0, deadline - now) };
}

export type PetAction =
  | { kind: "adopt"; species: Species; name: string }
  | { kind: "rename"; name: string }
  | { kind: "buyFood"; food: Food; serve: boolean }
  | { kind: "feed"; food: Food }
  | { kind: "buyOutfit" | "wear"; outfit: Outfit }
  | { kind: "move"; position: Position }
  | { kind: "compact"; value: boolean };

export function act(state: PetState, action: PetAction, time: number): PetState {
  if (!Number.isSafeInteger(time) || time <= 0) return state;
  const { now, fullness, dead, days } = condition(state, time);
  const pet = state.pet;
  if (action.kind === "move") return { ...state, position: action.position };
  if (action.kind === "compact") return { ...state, compact: action.value };
  if (action.kind === "adopt") {
    const name = action.name.trim().slice(0, 24);
    if (!name || (pet && !dead)) return state;
    return { ...emptyPet(), revision: state.revision, observedAt: now,
      pet: { species: action.species, name, born: now, hungryAt: now + DAY },
      wardrobe: state.wardrobe, position: state.position, past: state.past + Number(Boolean(pet)),
      longest: Math.max(state.longest, days), compact: false };
  }
  if (!pet || dead) return state;
  if (action.kind === "rename") {
    const name = action.name.trim().slice(0, 24);
    return name ? { ...state, observedAt: now, pet: { ...pet, name } } : state;
  }
  if (action.kind === "feed" || action.kind === "buyFood") {
    const food = foods.find(item => item.id === action.food)!;
    const buy = action.kind === "buyFood";
    const feed = !buy || action.serve;
    const count = state.bag[food.id] ?? 0;
    if ((buy ? state.coins < food.price : count < 1) || (feed && Math.ceil(fullness) >= 100)) return state;
    return { ...state, observedAt: now, coins: state.coins - (buy ? food.price : 0),
      bag: { ...state.bag, [food.id]: count + Number(buy) - Number(feed) },
      pet: feed ? { ...pet, hungryAt: now + Math.min(100, fullness + food.points) * DAY / 100 } : pet };
  }
  const item = outfits.find(option => option.id === action.outfit)!;
  const owned = state.wardrobe.includes(item.id);
  if (action.kind === "buyOutfit") {
    if (owned || state.coins < item.price) return state;
    return { ...state, observedAt: now, coins: state.coins - item.price, wardrobe: [...state.wardrobe, item.id] };
  }
  if (!owned) return state;
  return { ...state, observedAt: now, wearing: { ...state.wearing,
    [item.slot]: state.wearing[item.slot] === item.id ? undefined : item.id } };
}

/** A cumulative watermark survives retries, refreshes and duplicate observations on another device. */
export function credit(state: PetState, timer: ActiveTimer | undefined, time: number): PetState {
  const pet = state.pet;
  if (!pet || !timer || timer.mode !== "focus" || timer.prepared || !Number.isSafeInteger(time)) return state;
  const start = Date.parse(timer.startedAt);
  const end = Date.parse(timer.plannedEndAt);
  const paused = timer.isRunning || timer.pendingSettlement === "pending" ? end : Date.parse(timer.pausedAt ?? "");
  const speed = timer.speedMultiplier ?? 1;
  if (speed < 1 || !Number.isFinite(speed) || !Number.isFinite(start) || !Number.isFinite(end) || end < start) return state;
  const duration = timer.duration * 1000 / speed;
  const until = Math.min(time, end, paused, start + duration + timer.totalPausedSeconds * 1000, pet.hungryAt + 2 * DAY);
  const elapsed = Math.min(duration, until - start - timer.totalPausedSeconds * 1000);
  if (!Number.isFinite(elapsed) || !Number.isFinite(duration) || duration <= 0 || start <= 0 ||
      timer.totalPausedSeconds < 0 || until < pet.born || elapsed < 0) return state;
  const last = state.cursor;
  if (last && (start < last.start || until < last.through)) return state;
  const same = last?.session === timer.sessionId && last.start === start;
  const pausedRemaining = !timer.isRunning && timer.pausedAt ? timer.remaining : undefined;
  if (same && last.pausedRemaining !== undefined && timer.isRunning && end <= last.end) return state;
  let from = until - elapsed;
  if (same) {
    if (last.pausedRemaining !== undefined && timer.isRunning) {
      // The timer rounds totalPausedSeconds. Recover the exact resume instant from its scheduled end.
      from = end - last.pausedRemaining * 1000 / speed;
    } else if (end === last.end || pausedRemaining !== undefined) {
      from = last.through;
    } else {
      from = until - (elapsed - last.elapsed);
    }
  }
  from = Math.max(pet.born, last?.through ?? start, start, from);
  const delta = Math.floor(until - from);
  if (delta < 0 || (delta === 0 && (!same || last.pausedRemaining === pausedRemaining))) return state;
  const total = state.remainder + delta;
  const coins = Math.floor(total / MINUTE);
  const day = todayKey(new Date(until));
  const midnight = new Date(until).setHours(0, 0, 0, 0);
  const beforeToday = Math.max(0, Math.min(delta, midnight - from - 1));
  const todayCoins = coins - Math.floor((state.remainder + beforeToday) / MINUTE);
  return { ...state, coins: state.coins + coins, remainder: total % MINUTE,
    observedAt: Math.max(state.observedAt, until), earnedDay: day,
    earned: (day === state.earnedDay ? state.earned : 0) + todayCoins,
    cursor: { session: timer.sessionId, start, elapsed, through: until, end, pausedRemaining } };
}
