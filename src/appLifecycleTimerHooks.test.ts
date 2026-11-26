import { afterEach, describe, expect, it, vi } from "vitest";
import { startTimerInState } from "./appModel";
import { createInitialState } from "./test/fixtures";
import { useRunningTimerInterval } from "./appLifecycleTimerHooks";

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
    const initial = createInitialState();
    const taskId = mode === "focus" ? initial.tasks[0].id : undefined;
    const state = startTimerInState(initial, mode, taskId, new Date().toISOString(),
      "expiring", { workSessionId: "work_expired" });
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
    useRunningTimerInterval(options);

    stateRef.current = { ...state, activeTimer: { ...state.activeTimer!, plannedEndAt: new Date(0).toISOString() } };
    callbacks[surface === "interval" ? 0 : 1]();
    callbacks.forEach((callback) => callback());

    expect(stateRef.current.activeTimer).toMatchObject({ mode: mode === "focus" ? "short_break" : "focus", prepared: true });
    expect(mocks.announceTimerEnd).toHaveBeenCalledOnce();
    if (mode === "focus") {
      expect(stateRef.current.tasks[0].actualPomodoros).toBe(initial.tasks[0].actualPomodoros + 1);
      expect(stateRef.current.workSessions.filter((session) => session.id === "work_expired" && session.status === "ended")).toHaveLength(1);
      expect(runTeamCommand).toHaveBeenCalledOnce();
      expect(runTeamCommand).toHaveBeenCalledWith(expect.objectContaining({ id: "work_expired", action: "finish" }));
    } else {
      expect(runTeamCommand).not.toHaveBeenCalled();
    }
    expect(setState.mock.calls[0][0].activeTimer?.sessionId).toBe(stateRef.current.activeTimer?.sessionId);
  });
});
