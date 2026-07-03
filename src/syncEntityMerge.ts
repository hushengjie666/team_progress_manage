import { applyDeletedSyncRow } from "./syncEntityMergeDeletion";
import { applyUpsertSyncRow } from "./syncEntityMergeUpsert";
import type { AppState } from "./types";
import type { SyncMergeOptions, SyncMergeRow } from "./syncEntityMergeTypes";

export type { SyncEntity, SyncMergeOptions, SyncMergeRow } from "./syncEntityMergeTypes";

export const applySyncRowToState = (
  state: AppState,
  row: SyncMergeRow,
  tombstones: AppState["sync"]["tombstones"],
  options: SyncMergeOptions = {},
) => {
  if (row.deleted_at) {
    return {
      state: applyDeletedSyncRow(state, row),
      tombstones: tombstones.filter((item) => !(item.entity === row.entity && item.id === row.id)),
    };
  }
  return { state: applyUpsertSyncRow(state, row, options), tombstones };
};
