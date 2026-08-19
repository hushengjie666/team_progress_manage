import type { WorkspaceAccountRuntime, WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";
import { createWorkspacePlatformAccountCommands } from "./workspacePlatformAccountCommands";
import { createWorkspacePlatformAccountRefresh } from "./workspacePlatformAccountRefresh";

type WorkspacePlatformAccountRuntime = Pick<
  WorkspaceAccountRuntime,
  | "refreshPlatformAccounts"
  | "createPlatformAccount"
  | "updatePlatformAccountProfile"
  | "disablePlatformAccount"
  | "updatePlatformAccountPassword"
>;

type WorkspacePlatformAccountRuntimeOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setToast" | "setPlatformAccounts" | "getPlatformAccounts"
>;

export function createWorkspacePlatformAccountRuntime({
  getState,
  setToast,
  setPlatformAccounts,
  getPlatformAccounts = () => [],
}: WorkspacePlatformAccountRuntimeOptions): WorkspacePlatformAccountRuntime {
  const refresh = createWorkspacePlatformAccountRefresh({
    getState,
    setPlatformAccounts,
  });
  const commands = createWorkspacePlatformAccountCommands({
    getState,
    setToast,
    setPlatformAccounts,
    getPlatformAccounts,
    ...refresh,
  });

  return {
    ...refresh,
    ...commands,
  };
}
