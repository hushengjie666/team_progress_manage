import { nowIso } from "./appModel";
import type { AuthSessionRuntimeOptions } from "./authSessionTypes";

type AuthSessionLogoutOptions = Pick<
  AuthSessionRuntimeOptions,
  | "updateState"
  | "setToast"
  | "setPlatformAccounts"
  | "setWorkspaceInvitations"
  | "setProjectInvitations"
  | "setSuppressAutoLogin"
>;

export function createAuthLogoutAction({
  updateState,
  setToast,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
  setSuppressAutoLogin,
}: AuthSessionLogoutOptions) {
  return () => {
    setSuppressAutoLogin(true);
    setPlatformAccounts([]);
    setWorkspaceInvitations([]);
    setProjectInvitations([]);
    updateState((value) => ({
      ...value,
      auth: {
        status: "signed_out",
        bootstrapped: true,
        message: "已退出登录",
      },
      backend: {
        ...value.backend,
        token: undefined,
        message: "已退出团队工作区",
      },
      updatedAt: nowIso(),
    }));
    setToast("已退出登录");
  };
}
