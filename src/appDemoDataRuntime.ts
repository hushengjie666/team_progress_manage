import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan, initialFilters, nowIso, type Tab, type TaskFilters } from "./appModel";
import { demoTaskIdForProject, mergeDemoDataIntoState } from "./demoData";
import type { AppState } from "./types";

type PersistTeamData = (
  current: AppState,
  next: AppState,
  options?: { refreshAfterSave?: boolean },
) => Promise<AppState | undefined>;
type Setter<T> = (value: T | ((current: T) => T)) => void;

export type AppDemoDataRuntimeOptions = {
  getState: () => AppState | null;
  getSelectedProjectId: () => string | null;
  persistTeamData: PersistTeamData;
  setState: Setter<AppState | null>;
  setToast: (message: string) => void;
  setSelectedProjectId: Setter<string | null>;
  setProjectDetailTab: (tab: "overview") => void;
  setSelectedTaskId: Setter<string | null>;
  setTaskFilters: Setter<TaskFilters>;
  setTab: (tab: Tab) => void;
};

export type AppDemoDataRuntime = {
  loadDemoData: () => Promise<void>;
};

export function createAppDemoDataRuntime({
  getState,
  getSelectedProjectId,
  persistTeamData,
  setState,
  setToast,
  setSelectedProjectId,
  setProjectDetailTab,
  setSelectedTaskId,
  setTaskFilters,
  setTab,
}: AppDemoDataRuntimeOptions): AppDemoDataRuntime {
  const loadDemoData = async () => {
    const current = getState();
    const selectedProjectId = getSelectedProjectId();
    const targetProjectId =
      current && selectedProjectId && current.projects.some((project) => project.id === selectedProjectId)
        ? selectedProjectId
        : current?.projects[0]?.id;
    if (!current || !targetProjectId) {
      setToast("没有可加载演示数据的项目");
      return;
    }
    const token = current.auth.token ?? current.backend.token;
    if (!token) {
      setToast("请先登录团队后台后再加载演示数据");
      return;
    }
    setToast("正在写入团队后台...");
    try {
      const next = ensureTodayPlan(mergeDemoDataIntoState(current, targetProjectId, nowIso()));
      const saved = await persistTeamData(current, next, { refreshAfterSave: true });
      if (!saved) return;
      setSelectedProjectId(targetProjectId);
      setProjectDetailTab("overview");
      setSelectedTaskId(demoTaskIdForProject("demo_task_today_deep", targetProjectId));
      setTaskFilters(initialFilters);
      setTab("project");
      setToast("已将演示数据写入团队后台");
    } catch (error) {
      const failed = applyTeamStateLoadFailure(current, error);
      setState(failed);
      setToast(failed.backend.message);
    }
  };

  return { loadDemoData };
}
