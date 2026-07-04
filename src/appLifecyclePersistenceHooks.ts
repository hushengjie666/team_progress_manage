import { useEffect } from "react";
import { loadInitialAppState } from "./appBootRuntime";
import { saveState } from "./storage";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";

export function useStateRef({
  state,
  stateRef,
}: Pick<AppLifecycleHooksOptions, "state" | "stateRef">) {
  useEffect(() => {
    stateRef.current = state;
  }, [state]);
}

export function useNavigationRefs({
  tab,
  selectedTaskId,
  tabRef,
  selectedTaskIdRef,
}: Pick<AppLifecycleHooksOptions, "tab" | "selectedTaskId" | "tabRef" | "selectedTaskIdRef">) {
  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);
}

export function useToastVisibility({
  toast,
  setToastVisible,
}: Pick<AppLifecycleHooksOptions, "toast" | "setToastVisible">) {
  useEffect(() => {
    if (!toast) {
      setToastVisible(false);
      return;
    }
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);
}

export function useUndoTimerCleanup({
  undoTimerRef,
}: Pick<AppLifecycleHooksOptions, "undoTimerRef">) {
  useEffect(
    () => () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    },
    [],
  );
}

export function useInitialAppLoad({
  persistTeamData,
  setState,
  setToast,
  setLoaded,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
}: Pick<
  AppLifecycleHooksOptions,
  | "persistTeamData"
  | "setState"
  | "setToast"
  | "setLoaded"
  | "setPlatformAccounts"
  | "setWorkspaceInvitations"
  | "setProjectInvitations"
>) {
  useEffect(() => {
    loadInitialAppState({ persistTeamData })
      .then((result) => {
        setPlatformAccounts(result.platformAccounts);
        setWorkspaceInvitations(result.workspaceInvitations);
        setProjectInvitations(result.projectInvitations);
        if (result.state) setState(result.state);
        if (result.toast) setToast(result.toast);
        setLoaded(true);
      })
      .catch(() => {
        setToast("读取应用缓存失败，已加载默认数据");
      });
  }, []);
}

export function useDebouncedStatePersistence({
  state,
  loaded,
  setToast,
}: Pick<AppLifecycleHooksOptions, "state" | "loaded" | "setToast">) {
  useEffect(() => {
    if (!state || !loaded) return;
    const handle = window.setTimeout(() => {
      saveState(state).catch(() => setToast("保存应用缓存失败，请检查存储权限"));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state, loaded]);
}

export function usePageLifecycleStateFlush({
  stateRef,
}: Pick<AppLifecycleHooksOptions, "stateRef">) {
  useEffect(() => {
    const flushState = () => {
      const current = stateRef.current;
      if (!current) return;
      void saveState(current);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushState();
    };
    window.addEventListener("pagehide", flushState);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushState);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, []);
}
