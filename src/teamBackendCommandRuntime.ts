import { createBackendConnectionCommands } from "./teamBackendConnectionCommands";
import { createBackendDataCommands } from "./teamBackendDataCommands";
import type { BackendCommandRuntime, BackendCommandRuntimeOptions } from "./teamBackendCommandTypes";
import type { BackendConnectionState } from "./types";

export type { BackendCommandRuntime, BackendCommandRuntimeOptions } from "./teamBackendCommandTypes";

export function createBackendCommandRuntime({
  getState,
  getBackendPassword,
  setState,
  updateState,
  setToast,
  setBackendDiagnostic,
}: BackendCommandRuntimeOptions): BackendCommandRuntime {
  const setBackendConnectionStatus = (patch: Partial<BackendConnectionState>) => {
    updateState((current) => ({
      ...current,
      backend: { ...current.backend, ...patch },
    }));
  };

  const connectionCommands = createBackendConnectionCommands({
    getState,
    getBackendPassword,
    updateState,
    setBackendConnectionStatus,
    setToast,
  });
  const dataCommands = createBackendDataCommands({
    getState,
    getBackendPassword,
    setState,
    setBackendConnectionStatus,
    setToast,
    setBackendDiagnostic,
  });

  return {
    ...connectionCommands,
    ...dataCommands,
  };
}
