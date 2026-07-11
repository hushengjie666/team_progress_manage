import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { resetNativeTimerSync, syncNativeTimer } from "./nativeTimerBridge";
import type { ActiveTimer, Task } from "./types";

const activeTimer: ActiveTimer = {
  sessionId: "session_mobile",
  taskId: "task_mobile",
  mode: "focus",
  duration: 1500,
  remaining: 1200,
  isRunning: true,
  startedAt: "2026-07-11T00:00:00.000Z",
  plannedEndAt: "2026-07-11T00:25:00.000Z",
  totalPausedSeconds: 0,
  cycleIndex: 1,
};

const originalLocalStorage = globalThis.localStorage;
const values = new Map<string, string>();
const memoryStorage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem: (key: string, value: string) => values.set(key, value),
  removeItem: (key: string) => values.delete(key),
  clear: () => values.clear(),
};

beforeAll(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: memoryStorage });
});

afterAll(() => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: originalLocalStorage });
});

beforeEach(() => {
  localStorage.clear();
  resetNativeTimerSync();
});

describe("native timer bridge", () => {
  it("persists a recoverable timer snapshot without requiring a native runtime", async () => {
    await syncNativeTimer(activeTimer, { id: "task_mobile", title: "手机专注任务" } as Task);
    const snapshot = JSON.parse(localStorage.getItem("timemanage.ios.activeTimer.v1") ?? "null");
    expect(snapshot).toMatchObject({ timer: { sessionId: "session_mobile" }, taskTitle: "手机专注任务" });
  });

  it("clears the snapshot after the timer ends", async () => {
    await syncNativeTimer(activeTimer);
    resetNativeTimerSync();
    await syncNativeTimer(undefined);
    expect(localStorage.getItem("timemanage.ios.activeTimer.v1")).toBeNull();
  });
});
