import type { QuickProjectCreateDraft } from "./components/QuickProjectCreateModal";
import type { AppState } from "./types";

type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppQuickProjectRuntimeOptions = {
  getState: () => AppState;
  getDraft: () => QuickProjectCreateDraft;
  setDraft: Setter<QuickProjectCreateDraft>;
  setWarning: Setter<string>;
  setOpen: Setter<boolean>;
  createProject: (
    name: string,
    description: string,
    workspaceId?: string,
    taskStageMode?: QuickProjectCreateDraft["taskStageMode"],
  ) => void;
};

export type AppQuickProjectRuntime = {
  visibleWorkspaces: NonNullable<AppState["auth"]["workspaces"]>;
  defaultQuickProjectWorkspaceId: string;
  openQuickProjectCreate: () => void;
  closeQuickProjectCreate: () => void;
  submitQuickProjectCreate: () => void;
};

export function createAppQuickProjectRuntime({
  getState,
  getDraft,
  setDraft,
  setWarning,
  setOpen,
  createProject,
}: AppQuickProjectRuntimeOptions): AppQuickProjectRuntime {
  const state = getState();
  const visibleWorkspaces = state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);
  const defaultQuickProjectWorkspaceId =
    visibleWorkspaces.find((workspace) => workspace.type === "private")?.id ?? visibleWorkspaces[0]?.id ?? "";

  const openQuickProjectCreate = () => {
    setDraft({
      name: "",
      description: "",
      workspaceId: defaultQuickProjectWorkspaceId,
      taskStageMode: "regular",
    });
    setWarning("");
    setOpen(true);
  };

  const closeQuickProjectCreate = () => {
    setOpen(false);
    setWarning("");
  };

  const submitQuickProjectCreate = () => {
    const draft = getDraft();
    const name = draft.name.trim();
    if (!name) {
      setWarning("项目名称不能为空");
      return;
    }
    const workspaceId = draft.workspaceId || defaultQuickProjectWorkspaceId;
    if (!workspaceId) {
      setWarning("当前账号没有可用工作区");
      return;
    }
    createProject(name, draft.description, workspaceId, draft.taskStageMode);
    closeQuickProjectCreate();
  };

  return {
    visibleWorkspaces,
    defaultQuickProjectWorkspaceId,
    openQuickProjectCreate,
    closeQuickProjectCreate,
    submitQuickProjectCreate,
  };
}
