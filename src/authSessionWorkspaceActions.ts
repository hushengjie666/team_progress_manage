import type { Tab } from "./appModel";
import { clearRememberedAuth, saveRememberedAuth } from "./rememberedAuth";
import { createWorkspace, loginToWorkspace, type AuthSession } from "./teamBackend";
import type { AppState, AuthState } from "./types";

export function createAuthWorkspaceActions({
  getState,
  setAuthPatch,
  applySession,
  setToast,
  setSuppressAutoLogin,
  setSelectedTaskId,
  setPreferredFocusTaskId,
  setWorkspaceMode,
  setTab,
}: {
  getState: () => AppState | null;
  setAuthPatch: (patch: Partial<AuthState>) => void;
  applySession: (session: AuthSession, message: string, options?: { resetRuntime?: boolean }) => Promise<void>;
  setToast: (message: string) => void;
  setSuppressAutoLogin: (suppressed: boolean) => void;
  setSelectedTaskId: (taskId: string | null) => void;
  setPreferredFocusTaskId: (taskId: string | null) => void;
  setWorkspaceMode: (mode: "board" | "workbench") => void;
  setTab: (tab: Tab) => void;
}) {
  const handleCreateWorkspace = async (workspaceName?: string, options: { returnTo?: Tab } = {}) => {
    const source = getState();
    const token = source?.auth.token;
    if (!source || !token) return;
    const name = workspaceName ?? window.prompt("协作工作区名称") ?? "";
    if (!name.trim()) return;
    setAuthPatch({ status: "checking", message: "正在创建协作工作区" });
    try {
      const session = await createWorkspace(source.backend, token, name.trim());
      setSelectedTaskId(null);
      setPreferredFocusTaskId(null);
      setWorkspaceMode("board");
      if (options.returnTo) {
        setTab(options.returnTo);
      } else if (workspaceName !== undefined) {
        setTab("workspaces");
      } else {
        setTab("workspace");
      }
      await applySession(session, `已创建 ${session.workspace.name}`, { resetRuntime: true });
      setToast(`已创建 ${session.workspace.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建工作区失败";
      setAuthPatch({ status: "error", message });
      setToast(message);
    }
  };

  const handleWorkspaceLogin = async (email: string, password: string, remember = true) => {
    setAuthPatch({ status: "checking", message: "正在登录账号" });
    try {
      const source = getState();
      if (!source) throw new Error("应用状态尚未加载");
      const session = await loginToWorkspace(source.backend, email, password);
      if (remember) saveRememberedAuth(source.backend.serverUrl, session.account.email, password);
      else clearRememberedAuth(source.backend.serverUrl);
      setSuppressAutoLogin(false);
      await applySession(session, `已登录 ${session.workspace.name}`);
      setToast("账号已登录");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setAuthPatch({ status: "error", message });
      setToast(message);
    }
  };

  return {
    handleCreateWorkspace,
    handleWorkspaceLogin,
  };
}
