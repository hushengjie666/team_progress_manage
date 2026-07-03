import { createSyncConnectionCommands } from "./syncConnectionCommands";
import { createSyncDataCommands } from "./syncDataCommands";
import type { SyncCommandRuntime, SyncCommandRuntimeOptions } from "./syncCommandTypes";
import type { SyncState } from "./types";

export type { SyncCommandRuntime, SyncCommandRuntimeOptions } from "./syncCommandTypes";

export function createSyncCommandRuntime({
  getState,
  getSyncPassword,
  setState,
  updateState,
  setToast,
  setSyncDiagnostic,
}: SyncCommandRuntimeOptions): SyncCommandRuntime {
  const setSyncStatus = (patch: Partial<SyncState>) => {
    updateState((current) => ({
      ...current,
      sync: { ...current.sync, ...patch, tombstones: patch.tombstones ?? current.sync.tombstones },
    }));
  };

  const connectionCommands = createSyncConnectionCommands({
    getState,
    getSyncPassword,
    updateState,
    setSyncStatus,
    setToast,
  });
  const dataCommands = createSyncDataCommands({
    getState,
    getSyncPassword,
    setState,
    setSyncStatus,
    setToast,
    setSyncDiagnostic,
  });

  return {
    ...connectionCommands,
    ...dataCommands,
  };
}
