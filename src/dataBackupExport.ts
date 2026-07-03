import { uid } from "./seed";
import type { AppState, BackupSnapshot } from "./types";

export type ExportableState = Omit<AppState, "backupSnapshots"> & { backupSnapshots?: BackupSnapshot[] };

const stripBackupPayloads = (state: AppState): ExportableState => ({
  ...state,
  backupSnapshots: (state.backupSnapshots ?? []).map((snapshot) => ({ ...snapshot, payload: undefined })),
});

export const createBackupSnapshot = (state: AppState, reason: BackupSnapshot["reason"], timestamp = new Date().toISOString()): BackupSnapshot => ({
  id: uid("backup"),
  createdAt: timestamp,
  reason,
  taskCount: state.tasks.length,
  sessionCount: state.focusSessions.length,
  planCount: state.dailyPlans.length,
  sourceVersion: state.version,
  payload: JSON.stringify(stripBackupPayloads(state), null, 2),
});

export const exportStateJson = (state: AppState) =>
  JSON.stringify(
    {
      ...stripBackupPayloads(state),
      exportedAt: new Date().toISOString(),
    },
    null,
    2,
  );
