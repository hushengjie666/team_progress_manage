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
  it.each([
    ["interval", "focus"], ["restore", "focus"],
    ["interval", "short_break"], ["restore", "short_break"],
    ["interval", "long_break"], ["restore", "long_break"],
  ] as const)("settles and announces once when %s callbacks expire %s before React renders", (surface, mode) => {
    const state = startTimerInState(createInitialState(), mode, undefined,
      new Date(Date.now() - 26 * 60_000).toISOString());
    if (mode === "focus") state.activeTimer!.workSessionId = "work_expired";
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

    expect(stateRef.current.activeTimer).toMatchObject({ mode: mode === "focus" ? "short_break" : "focus", prepared: true });
    expect(mocks.announceTimerEnd).toHaveBeenCalledOnce();
    if (mode === "focus") {
      expect(runTeamCommand).toHaveBeenCalledOnce();
      expect(runTeamCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "work_expired", action: "finish" }));
    } else {
      expect(runTeamCommand).not.toHaveBeenCalled();
    }
    expect(setState.mock.calls[0][0].activeTimer?.sessionId).toBe(stateRef.current.activeTimer?.sessionId);
  });
});
