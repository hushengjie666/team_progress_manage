import { applyTeamStateLoadFailure } from "./appBoot";
import { loadTeamBusinessState, saveTeamBusinessChanges } from "./teamBusinessApi";
import type { AppState } from "./types";

export type TeamBusinessRuntimeOptions = {
  getState: () => AppState | null;
  setState: (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
  setToast: (message: string) => void;
};

export type PersistBusinessChangesOptions = {
  showFailureToast?: boolean;
  refreshAfterSave?: boolean;
  applySuccessState?: boolean;
  applyFailureState?: boolean;
  canApplyState?: () => boolean;
};

export type TeamBusinessRuntime = {
  persistBusinessChanges: (
    before: AppState,
    after: AppState,
    options?: PersistBusinessChangesOptions,
  ) => Promise<AppState | undefined>;
  commitBusinessState: (before: AppState, after: AppState) => void;
};

export const createTeamBusinessRuntime = ({ setState, setToast }: TeamBusinessRuntimeOptions): TeamBusinessRuntime => {
  let commitSequence = 0;

  const persistBusinessChanges = async (
    before: AppState,
    after: AppState,
    options: PersistBusinessChangesOptions = {},
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
      const saved = await saveTeamBusinessChanges(before.sync, token, before, after);
      const finalState = options.refreshAfterSave && saved ? await loadTeamBusinessState(saved) : saved;
      if (finalState && applySuccessState && canApplyState()) setState(finalState);
      return finalState;
    } catch (error) {
      const failed = applyTeamStateLoadFailure(after, error);
      if (applyFailureState && canApplyState()) setState(failed);
      if (showFailureToast && canApplyState()) setToast(failed.auth.message);
      return undefined;
    }
  };

  const commitBusinessState = (before: AppState, after: AppState) => {
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
    void persistBusinessChanges(before, after, {
      refreshAfterSave: true,
      canApplyState: () => sequence === commitSequence,
    });
  };

  return { persistBusinessChanges, commitBusinessState };
};
