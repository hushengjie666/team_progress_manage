import type { AppState } from "./types";
import { normalizeAppStatePayload } from "./storage";
import { applySyncRowToState } from "./syncEntityMerge";
import type { SyncRow } from "./syncPayloadTypes";
import { withStatus } from "./syncHttp";

const nowIso = () => new Date().toISOString();

export function mergeRowsIntoState(
  state: AppState,
  rows: SyncRow[],
  currentRevision: number,
  options: { forceRemote?: boolean } = {},
): AppState {
  let next = { ...state };
  let tombstones = [...(state.sync.tombstones ?? [])];

  for (const row of rows) {
    const result = applySyncRowToState(next, row, tombstones, { forceRemote: options.forceRemote });
    next = result.state;
    tombstones = result.tombstones;
  }

  const timestamp = nowIso();
  return normalizeAppStatePayload({
    ...next,
    sync: withStatus(next.sync, {
      lastPulledRevision: currentRevision,
      tombstones,
      lastSyncedAt: timestamp,
    }),
    updatedAt: timestamp,
  });
}
