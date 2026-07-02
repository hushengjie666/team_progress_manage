import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan } from "./appModel";
import { loadTeamState, pushTeamChanges } from "./teamApi";
import type { AppState } from "./types";

export type TeamStateRuntimeOptions = {
  getState: () => AppState | null;
  setState: (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
  setToast: (message: string) => void;
};

export type PersistTeamChangesOptions = {
  showFailureToast?: boolean;
  refreshAfterSave?: boolean;
  applySuccessState?: boolean;
  applyFailureState?: boolean;
  canApplyState?: () => boolean;
};

export type TeamStateRuntime = {
  persistTeamChanges: (
    before: AppState,
    after: AppState,
    options?: PersistTeamChangesOptions,
  ) => Promise<AppState | undefined>;
  commitTeamState: (before: AppState, after: AppState) => void;
};

export const createTeamStateRuntime = ({ setState, setToast }: TeamStateRuntimeOptions): TeamStateRuntime => {
  let commitSequence = 0;

  const persistTeamChanges = async (
    before: AppState,
    after: AppState,
    options: PersistTeamChangesOptions = {},
  ) => {
    const token = before.auth.token ?? before.sync.token;
    if (!token) {
      if (options.applySuccessState ?? false) setState(after);
      return after;
    }
    const showFailureToast = options.showFailureToast ?? true;
    const applySuccessState = options.applySuccessState ?? true;
    const applyFailureState = options.applyFailureState ?? true;
    const canApplyState = options.canApplyState ?? (() => true);
    try {
      const revision = await pushTeamChanges(before.sync, token, before, after);
      const saved = {
        ...after,
        sync: {
          ...after.sync,
          lastPulledRevision: Math.max(after.sync.lastPulledRevision, revision ?? after.sync.lastPulledRevision),
          status: "synced" as const,
          message: "团队在线数据已保存",
        },
      };
      const finalState = options.refreshAfterSave ? ensureTodayPlan(await loadTeamState(saved)) : saved;
      if (applySuccessState && canApplyState()) setState(finalState);
      return finalState;
    } catch (error) {
      const failed = applyTeamStateLoadFailure(after, error);
      if (applyFailureState && canApplyState()) setState(failed);
      if (showFailureToast && canApplyState()) setToast(failed.auth.message);
      return undefined;
    }
  };

  const commitTeamState = (before: AppState, after: AppState) => {
    const token = before.auth.token ?? before.sync.token;
    if (!token) {
      setState(after);
      return;
    }
    const sequence = ++commitSequence;
    setState({
      ...after,
      sync: {
        ...after.sync,
        status: "syncing",
        message: "正在写入团队后台",
      },
    });
    void persistTeamChanges(before, after, {
      refreshAfterSave: true,
      canApplyState: () => sequence === commitSequence,
    });
  };

  return { persistTeamChanges, commitTeamState };
};
