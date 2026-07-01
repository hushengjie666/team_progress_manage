import type { SyncRevisionEvent } from "./sync";
import type { AppState, SyncState } from "./types";

type TimerRef = { current: number | null };
type RevisionRef = { current: number };

export const syncTokenForState = (state?: AppState | null) => state?.auth.token ?? state?.sync.token;

export const canRunAutoSync = (state?: AppState | null, token = syncTokenForState(state)) =>
  Boolean(state?.sync.enabled && token && state.sync.autoSync);

export const retryIsWaiting = (sync: SyncState, nowMs = Date.now()) =>
  Boolean(sync.nextRetryAt && nowMs < new Date(sync.nextRetryAt).getTime());

export const shouldRequestIntervalSync = (state?: AppState | null, token = syncTokenForState(state), nowMs = Date.now()) => {
  if (!state || !canRunAutoSync(state, token)) return false;
  if (retryIsWaiting(state.sync, nowMs)) return false;
  return state.sync.status !== "syncing" && state.sync.status !== "authenticating";
};

export const parseSyncRevisionEvent = (data: string): SyncRevisionEvent | undefined => {
  try {
    return JSON.parse(data) as SyncRevisionEvent;
  } catch {
    return undefined;
  }
};

export const shouldRequestRemoteRevision = (
  state?: AppState | null,
  token = syncTokenForState(state),
  revision = 0,
) => {
  if (!state || !canRunAutoSync(state, token)) return false;
  if (revision <= state.sync.lastPulledRevision) return false;
  return state.sync.status !== "authenticating";
};

export const applyRemoteRevisionReceipt = (
  state: AppState,
  revision: number,
  sseStatus?: SyncState["sseStatus"],
): AppState => ({
  ...state,
  sync: {
    ...state.sync,
    ...(sseStatus ? { sseStatus } : {}),
    lastReceivedRevision: Math.max(state.sync.lastReceivedRevision ?? 0, revision),
    pendingRemoteRevision: Math.max(state.sync.pendingRemoteRevision ?? 0, revision),
  },
});

export const withSseStatus = (state: AppState, sseStatus: SyncState["sseStatus"]): AppState => ({
  ...state,
  sync: {
    ...state.sync,
    sseStatus,
  },
});

export const remoteRevisionDelay = (
  syncInFlight: boolean,
  status: SyncState["status"],
  busyRetryMs: number,
  debounceMs: number,
) => (syncInFlight || status === "syncing" ? busyRetryMs : debounceMs);

export const shouldRequestFullReconcile = (
  loaded: boolean,
  state?: AppState | null,
  token = syncTokenForState(state),
  requiredVersion = 0,
) => Boolean(loaded && canRunAutoSync(state, token) && state?.sync.lastFullReconcileVersion !== requiredVersion);

export const clearRemoteSyncDebounce = (
  remoteSyncDebounceRef: TimerRef,
  remoteSyncTargetRevisionRef: RevisionRef,
  clearTimeoutFn: (timer: number) => void,
) => {
  if (remoteSyncDebounceRef.current !== null) {
    clearTimeoutFn(remoteSyncDebounceRef.current);
    remoteSyncDebounceRef.current = null;
  }
  remoteSyncTargetRevisionRef.current = 0;
};

export const clearSyncRuntimeTimers = (
  syncDebounceRef: TimerRef,
  remoteSyncDebounceRef: TimerRef,
  remoteSyncTargetRevisionRef: RevisionRef,
  clearTimeoutFn: (timer: number) => void,
) => {
  if (syncDebounceRef.current !== null) {
    clearTimeoutFn(syncDebounceRef.current);
    syncDebounceRef.current = null;
  }
  clearRemoteSyncDebounce(remoteSyncDebounceRef, remoteSyncTargetRevisionRef, clearTimeoutFn);
};
