import { afterEach, describe, expect, it, vi } from "vitest";
import { startTimerInState } from "./appModel";
import { createInitialState } from "./test/fixtures";
import { useRunningTimerInterval, useTimerRestoreListeners } from "./appLifecycleTimerHooks";

const mocks = vi.hoisted(() => ({ announceTimerEnd: vi.fn() }));
vi.mock("react", () => ({ useEffect: (effect: () => unknown) => effect() }));
vi.mock("./timerRuntime", () => ({ announceTimerEnd: mocks.announceTimerEnd }));

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("timer expiration lifecycle", () => {
  it.each(["interval", "restore"] as const)("settles once when %s callbacks arrive before React renders", (surface) => {
    const state = startTimerInState(createInitialState(), "focus", undefined,
      new Date(Date.now() - 26 * 60_000).toISOString());
    state.activeTimer!.workSessionId = "work_expired";
    const stateRef = { current: state };
    const callbacks: Array<() => void> = [];
    vi.stubGlobal("window", {
      setInterval: (callback: () => void) => { callbacks.push(callback); return 1; },
      clearInterval: vi.fn(),
      addEventListener: (_event: string, callback: () => void) => callbacks.push(callback),
      removeEventListener: vi.fn(),
    });
    vi.stubGlobal("document", { addEventListener: vi.fn(), removeEventListener: vi.fn() });
    const setState = vi.fn();
    const runTeamCommand = vi.fn();
    const options = { state, stateRef, setState, runTeamCommand, setToast: vi.fn() };
    if (surface === "interval") useRunningTimerInterval(options);
    else useTimerRestoreListeners(options);

    callbacks[0]();
    callbacks[0]();

    expect(stateRef.current.activeTimer).toMatchObject({ mode: "short_break", prepared: true });
    expect(mocks.announceTimerEnd).toHaveBeenCalledOnce();
    expect(runTeamCommand).toHaveBeenCalledOnce();
    expect(runTeamCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "work_expired", action: "finish" }));
    expect(setState.mock.calls[0][0].activeTimer?.sessionId).toBe(stateRef.current.activeTimer?.sessionId);
  });
});
