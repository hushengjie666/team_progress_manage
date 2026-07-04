import { fetchPlatformAccounts } from "./teamBackend";
import { platformAccountAdminToken } from "./workspacePlatformAccountAccess";
import type { WorkspaceAccountRuntimeOptions } from "./workspaceAccountTypes";

type WorkspacePlatformAccountRefreshOptions = Pick<
  WorkspaceAccountRuntimeOptions,
  "getState" | "setPlatformAccounts"
>;

export function createWorkspacePlatformAccountRefresh({
  getState,
  setPlatformAccounts,
}: WorkspacePlatformAccountRefreshOptions) {
  const refreshPlatformAccounts = async (source = getState()) => {
    const token = platformAccountAdminToken(source);
    if (!source || !token) {
      setPlatformAccounts([]);
      return [];
    }
    const accounts = await fetchPlatformAccounts(source.backend, token);
    setPlatformAccounts(accounts);
    return accounts;
  };

  return {
    refreshPlatformAccounts,
  };
}
