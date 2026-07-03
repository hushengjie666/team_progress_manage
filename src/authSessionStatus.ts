import { getAuthStatus } from "./sync";
import type { AppState, AuthState } from "./types";

export function createAuthStatusAction({
  getState,
  setAuthPatch,
}: {
  getState: () => AppState | null;
  setAuthPatch: (patch: Partial<AuthState>) => void;
}) {
  return async () => {
    setAuthPatch({ status: "checking", message: "正在检查后台服务" });
    const source = getState();
    if (!source) return;
    try {
      const status = await getAuthStatus(source.sync.serverUrl);
      setAuthPatch({
        status: source.auth.token ? "authenticated" : "signed_out",
        bootstrapped: status.bootstrapped,
        message: "请使用管理员分配的账号登录",
      });
    } catch (error) {
      setAuthPatch({
        status: "error",
        message: error instanceof Error ? `认证服务不可用：${error.message}` : "认证服务不可用",
      });
    }
  };
}
