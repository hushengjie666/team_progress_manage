import { afterEach, expect, it, vi } from "vitest";
import { createInitialState } from "../test/fixtures";
import { TeamHttpError } from "../teamBackendHttp";
import { act, DAY, emptyPet, type PetState } from "./model";
import { PetStore } from "./store";

const network = vi.hoisted(() => ({ read: vi.fn(), patch: vi.fn() }));
vi.mock("../teamBackendHttp", async original => ({ ...await original<typeof import("../teamBackendHttp")>(), requestJson: network.read }));
vi.mock("../teamDomainCommands", () => ({ submitTeamDomainCommand: network.patch }));
afterEach(() => { vi.unstubAllGlobals(); vi.clearAllMocks(); });

it("rebases purchases and duplicate focus observations across devices without overwriting other account settings", async () => {
  const start = 1_800_000_000_000;
  const accounts = new Map<string, PetState>();
  const initial = { ...act(emptyPet(), { kind: "adopt", name: "米米", species: "cat" }, start), coins: 240, revision: 1 };
  accounts.set("first", initial);
  const values = new Map<string, string>();
  const storage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) };
  vi.stubGlobal("localStorage", storage);
  vi.stubGlobal("sessionStorage", { getItem: () => null, setItem: () => {} });
  network.read.mockImplementation(async (_url, init) => ({
    settings: { focusPet: accounts.get(init.headers.Authorization.slice(7)), dailyQuotes: { time: "08:00" } },
  }));
  network.patch.mockImplementation(async (_backend, account, cmd) => {
    expect(Object.keys(cmd.patch)).toEqual(["focusPet"]);
    const next = cmd.patch.focusPet;
    if (next.revision !== (accounts.get(account)?.revision ?? 0) + 1) throw new TeamHttpError(409, "conflict");
    accounts.set(account, next);
    return { settings: cmd.patch };
  });
  const backend = createInitialState().backend;
  const device = (account: string) => new PetStore(backend, account, account, () => {});
  const a = device("first"), b = device("first");
  await Promise.all([a.refresh(), b.refresh()]);
  const buy = { kind: "buyOutfit", outfit: "leaf" } as const;
  expect(await a.action(buy, start)).toBe(true);
  expect(await b.action(buy, start)).toBe(false);
  expect(b.state.coins).toBe(120);
  const timer = { mode: "focus" as const, sessionId: "run", duration: 120, remaining: 60, isRunning: true,
    startedAt: new Date(start).toISOString(), plannedEndAt: new Date(start + 120_000).toISOString(),
    totalPausedSeconds: 0, cycleIndex: 1 };
  a.observe(timer, start + 60_000);
  b.observe(timer, start + 60_000);
  await Promise.all([a.refresh(), b.refresh()]);
  expect([a.state.coins, b.state.coins]).toEqual([121, 121]);
  const second = device("second");
  await second.refresh();
  expect(second.state.pet).toBeUndefined();
  expect(device("first").state.pet?.name).toBe("米米");
  // A stale feeding action must never be replayed against a replacement pet.
  await a.action({ kind: "adopt", name: "新伙伴", species: "penguin" }, start + 4 * DAY);
  expect(await b.action({ kind: "rename", name: "旧宠的新名" }, start + 60_000)).toBe(false);
  expect(b.state.pet?.name).toBe("新伙伴");
});
