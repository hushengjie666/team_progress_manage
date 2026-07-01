import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "./seed";
import {
  applyRemoteRevisionReceipt,
  canRunAutoSync,
  clearSyncRuntimeTimers,
  parseSyncRevisionEvent,
  remoteRevisionDelay,
  shouldRequestFullReconcile,
  shouldRequestIntervalSync,
  shouldRequestRemoteRevision,
} from "./syncRuntime";

const autoSyncState = () => {
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
      lastPulledRevision: 3,
      status: "idle" as const,
    },
  };
};

describe("sync runtime", () => {
  it("checks whether automatic sync can run", () => {
    const state = autoSyncState();

    expect(canRunAutoSync(state)).toBe(true);
    expect(shouldRequestIntervalSync(state, "token", Date.parse("2026-07-01T08:00:00.000Z"))).toBe(true);
    expect(shouldRequestIntervalSync({
      ...state,
      sync: {
        ...state.sync,
        nextRetryAt: "2026-07-01T09:00:00.000Z",
      },
    }, "token", Date.parse("2026-07-01T08:00:00.000Z"))).toBe(false);
  });

  it("parses and filters remote revision events", () => {
    const state = autoSyncState();

    expect(parseSyncRevisionEvent("{bad json")).toBeUndefined();
    expect(parseSyncRevisionEvent("{\"current_revision\":5,\"workspace_id\":\"workspace\",\"time\":\"now\"}")?.current_revision).toBe(5);
    expect(shouldRequestRemoteRevision(state, "token", 2)).toBe(false);
    expect(shouldRequestRemoteRevision(state, "token", 5)).toBe(true);
  });

  it("records a received remote revision without lowering existing values", () => {
    const state = {
      ...autoSyncState(),
      sync: {
        ...autoSyncState().sync,
        lastReceivedRevision: 10,
        pendingRemoteRevision: 8,
      },
    };

    const next = applyRemoteRevisionReceipt(state, 9, "open");

    expect(next.sync.sseStatus).toBe("open");
    expect(next.sync.lastReceivedRevision).toBe(10);
    expect(next.sync.pendingRemoteRevision).toBe(9);
  });

  it("chooses remote revision delay based on current sync activity", () => {
    expect(remoteRevisionDelay(false, "idle", 1000, 250)).toBe(250);
    expect(remoteRevisionDelay(true, "idle", 1000, 250)).toBe(1000);
    expect(remoteRevisionDelay(false, "syncing", 1000, 250)).toBe(1000);
  });

  it("detects full reconcile needs", () => {
    expect(shouldRequestFullReconcile(true, autoSyncState(), "token", 3)).toBe(true);
    expect(shouldRequestFullReconcile(true, {
      ...autoSyncState(),
      sync: {
        ...autoSyncState().sync,
        lastFullReconcileVersion: 3,
      },
    }, "token", 3)).toBe(false);
  });

  it("clears local and remote sync timers", () => {
    const clearTimeout = vi.fn();
    const syncDebounceRef = { current: 1 };
    const remoteSyncDebounceRef = { current: 2 };
    const remoteSyncTargetRevisionRef = { current: 7 };

    clearSyncRuntimeTimers(syncDebounceRef, remoteSyncDebounceRef, remoteSyncTargetRevisionRef, clearTimeout);

    expect(clearTimeout).toHaveBeenCalledWith(1);
    expect(clearTimeout).toHaveBeenCalledWith(2);
    expect(syncDebounceRef.current).toBeNull();
    expect(remoteSyncDebounceRef.current).toBeNull();
    expect(remoteSyncTargetRevisionRef.current).toBe(0);
  });
});
