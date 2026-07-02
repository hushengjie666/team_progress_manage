import { ensureTodayPlan } from "./appModel";
import { mergeSyncedStateIntoLatest, syncAppState } from "./sync";
import { syncTokenForState } from "./syncRuntime";
import type { AppState, SyncState } from "./types";

type SetState = (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
type RevisionRef = { current: number };

export type RequestSyncOptions = {
  delayMs?: number;
  showToast?: boolean;
  targetRevision?: number;
  bypassRetry?: boolean;
};

export type SyncRequestRuntimeOptions = {
  getState: () => AppState | null;
  setState: SetState;
  setSyncStatus: (patch: Partial<SyncState>) => void;
  setToast: (message: string) => void;
  remoteSyncTargetRevisionRef: RevisionRef;
  localDebounceMs: number;
  enabled?: boolean;
  hasLiveWork?: (state: AppState) => boolean;
  setTimeoutFn?: (handler: () => void, timeout: number) => number;
  clearTimeoutFn?: (timer: number) => void;
};

export type SyncRequestRuntime = {
  requestSync: (reason: string, options?: RequestSyncOptions) => void;
  runSync: (showToast: boolean) => Promise<void>;
  isSyncInFlight: () => boolean;
  clearLocalDebounce: () => void;
};

export function createSyncRequestRuntime({
  getState,
  setState,
  setSyncStatus,
  setToast,
  remoteSyncTargetRevisionRef,
  localDebounceMs,
  enabled = true,
  hasLiveWork = () => false,
  setTimeoutFn = (handler, timeout) => window.setTimeout(handler, timeout),
  clearTimeoutFn = (timer) => window.clearTimeout(timer),
}: SyncRequestRuntimeOptions): SyncRequestRuntime {
  let syncInFlight = false;
  let syncDebounce: number | null = null;
  let pendingLocalSync = false;
  let lastSyncReason = "manual";

  const clearLocalDebounce = () => {
    if (syncDebounce === null) return;
    clearTimeoutFn(syncDebounce);
    syncDebounce = null;
  };

  const patchPendingState = (reason: string, pendingLocal = pendingLocalSync) => {
    setState((value) =>
      value
        ? {
            ...value,
            sync: {
              ...value.sync,
              pendingLocalSync: pendingLocal,
              pendingRemoteRevision: remoteSyncTargetRevisionRef.current || value.sync.pendingRemoteRevision,
              lastSyncReason: reason,
            },
          }
        : value,
    );
  };

  const requestSync = (reason: string, options: RequestSyncOptions = {}) => {
    if (!enabled) return;
    const current = getState();
    const token = syncTokenForState(current);
    if (!current?.sync.enabled || !token || !current.sync.autoSync) return;
    lastSyncReason = reason;
    if (options.targetRevision !== undefined) {
      remoteSyncTargetRevisionRef.current = Math.max(remoteSyncTargetRevisionRef.current, options.targetRevision);
    }
    if (reason === "local-change" && syncInFlight) {
      pendingLocalSync = true;
      patchPendingState(reason, true);
      return;
    }
    if (syncInFlight) {
      patchPendingState(reason);
      return;
    }
    if (!options.bypassRetry && current.sync.nextRetryAt && Date.now() < new Date(current.sync.nextRetryAt).getTime()) return;
    if (current.sync.status === "authenticating") return;
    clearLocalDebounce();
    syncDebounce = setTimeoutFn(() => {
      syncDebounce = null;
      void runSync(options.showToast ?? false);
    }, options.delayMs ?? localDebounceMs);
    patchPendingState(reason);
  };

  const runSync = async (showToast: boolean) => {
    const source = getState();
    if (!source || syncInFlight) return;
    syncInFlight = true;
    pendingLocalSync = false;
    const sourceRemoteTargetRevision = remoteSyncTargetRevisionRef.current;
    setSyncStatus({
      status: "syncing",
      message: "正在推送与拉取变更",
      pendingLocalSync: false,
      pendingRemoteRevision: sourceRemoteTargetRevision || undefined,
      lastSyncReason,
    });
    try {
      const nextState = await syncAppState({ ...source, sync: { ...source.sync, status: "syncing" } });
      const completedRevision = nextState.sync.lastPulledRevision;
      if (remoteSyncTargetRevisionRef.current <= completedRevision) {
        remoteSyncTargetRevisionRef.current = 0;
      }
      setState((current) => {
        const latest = current ?? source;
        const merged = latest === source ? nextState : mergeSyncedStateIntoLatest(latest, source, nextState);
        return ensureTodayPlan({
          ...merged,
          sync: {
            ...merged.sync,
            pendingLocalSync,
            pendingRemoteRevision: remoteSyncTargetRevisionRef.current || undefined,
            lastReceivedRevision: Math.max(merged.sync.lastReceivedRevision ?? 0, source.sync.lastReceivedRevision ?? 0),
            lastSyncReason,
          },
        });
      });
      if (showToast) setToast(nextState.sync.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      const retryCount = (source.sync.retryCount ?? 0) + 1;
      const delaySeconds = Math.min(15 * 60, 2 ** Math.min(retryCount, 6) * 10);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      setSyncStatus({
        status: "error",
        message: `${message}，${delaySeconds} 秒后自动重试`,
        retryCount,
        nextRetryAt,
      });
      if (showToast) setToast(message);
    } finally {
      syncInFlight = false;
      const current = getState();
      const hasPendingRemote = current ? remoteSyncTargetRevisionRef.current > current.sync.lastPulledRevision : remoteSyncTargetRevisionRef.current > 0;
      if (pendingLocalSync || hasPendingRemote) {
        requestSync(pendingLocalSync ? "pending-local" : "pending-remote", {
          delayMs: 0,
          bypassRetry: hasPendingRemote || Boolean(current && hasLiveWork(current)),
        });
      }
    }
  };

  return {
    requestSync,
    runSync,
    isSyncInFlight: () => syncInFlight,
    clearLocalDebounce,
  };
}
