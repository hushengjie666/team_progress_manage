import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import { createSyncRequestRuntime } from "./syncRequestRuntime";
import type { AppState, SyncState } from "./types";

const autoSyncState = (): AppState => {
  const state = createInitialState();
  return {
    ...state,
    auth: {
      ...state.auth,
      token: "token",
    },
    sync: {
      ...state.sync,
      enabled: true,
      autoSync: true,
      token: "token",
      status: "idle",
      lastPulledRevision: 3,
    },
  };
};

const createHarness = (initial: AppState | null = autoSyncState(), enabled = true) => {
  let current = initial;
  let syncPatch: Partial<SyncState> | undefined;
  let toast = "";
  const scheduled: Array<{ handler: () => void; timeout: number }> = [];
  const clearTimeoutFn = vi.fn();
  const runtime = createSyncRequestRuntime({
    getState: () => current,
    setState: (updater) => {
      current = typeof updater === "function" ? updater(current) : updater;
    },
    setSyncStatus: (patch) => {
      syncPatch = patch;
    },
    setToast: (message) => {
      toast = message;
    },
    remoteSyncTargetRevisionRef: { current: 0 },
    localDebounceMs: 800,
    enabled,
    setTimeoutFn: (handler, timeout) => {
      scheduled.push({ handler, timeout });
      return scheduled.length;
    },
    clearTimeoutFn,
  });
  return {
    runtime,
    scheduled,
    clearTimeoutFn,
    getCurrent: () => current,
    getSyncPatch: () => syncPatch,
    getToast: () => toast,
  };
};

describe("sync request runtime", () => {
  it("skips scheduling when the runtime is disabled", () => {
    const { runtime, scheduled } = createHarness(autoSyncState(), false);

    runtime.requestSync("local-change");

    expect(scheduled).toEqual([]);
  });

  it("records pending revision and reason while scheduling a sync", () => {
    const { runtime, scheduled, getCurrent } = createHarness();

    runtime.requestSync("revision-poll", { delayMs: 250, targetRevision: 9 });

    expect(scheduled[0]?.timeout).toBe(250);
    expect(getCurrent()?.sync.pendingRemoteRevision).toBe(9);
    expect(getCurrent()?.sync.lastSyncReason).toBe("revision-poll");
  });

  it("clears an existing local debounce before scheduling another one", () => {
    const { runtime, clearTimeoutFn } = createHarness();

    runtime.requestSync("local-change");
    runtime.requestSync("local-change");

    expect(clearTimeoutFn).toHaveBeenCalledWith(1);
  });

  it("does nothing when no state is loaded", async () => {
    const { runtime, getSyncPatch, getToast } = createHarness(null);

    await runtime.runSync(true);

    expect(getSyncPatch()).toBeUndefined();
    expect(getToast()).toBe("");
  });
});
