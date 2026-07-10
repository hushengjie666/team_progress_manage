import { applyTeamStateSaveFailure } from "./appBoot";
import { loadTeamData, saveTeamDataChanges } from "./teamBusinessApi";
import { TeamHttpError } from "./teamBackendHttp";
import type { AppState } from "./types";

export type TeamDataRuntimeOptions = {
  getState: () => AppState | null;
  setState: (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
  setToast: (message: string) => void;
};

export type PersistTeamDataOptions = {
  showFailureToast?: boolean;
  refreshAfterSave?: boolean;
  applySuccessState?: boolean;
  applyFailureState?: boolean;
  canApplyState?: () => boolean;
};

export type TeamDataRuntime = {
  persistTeamData: (
    current: AppState,
    next: AppState,
    options?: PersistTeamDataOptions,
  ) => Promise<AppState | undefined>;
  commitTeamData: (current: AppState, next: AppState) => void;
};

export const createTeamDataRuntime = ({ setState, setToast }: TeamDataRuntimeOptions): TeamDataRuntime => {
  let commitSequence = 0;
  let commitQueue = Promise.resolve();

  const persistTeamData = async (
    current: AppState,
    next: AppState,
    options: PersistTeamDataOptions = {},
  ) => {
    const token = current.auth.token ?? current.backend.token;
    if (!token) {
      if (options.applySuccessState ?? false) setState(next);
      return next;
    }
    const showFailureToast = options.showFailureToast ?? true;
    const applySuccessState = options.applySuccessState ?? true;
    const applyFailureState = options.applyFailureState ?? true;
    const canApplyState = options.canApplyState ?? (() => true);
    try {
      const saved = await saveTeamDataChanges(current.backend, token, current, next);
      const finalState = options.refreshAfterSave && saved ? await loadTeamData(saved) : saved;
      if (finalState && applySuccessState && canApplyState()) setState(finalState);
      return finalState;
    } catch (error) {
      let failureSource = next;
      if (error instanceof TeamHttpError && error.status === 409) {
        try {
          failureSource = await loadTeamData(current);
        } catch {
          failureSource = next;
        }
      }
      const failed = applyTeamStateSaveFailure(failureSource, error);
      if (applyFailureState && canApplyState()) setState(failed);
      if (showFailureToast && canApplyState()) setToast(failed.auth.message);
      return undefined;
    }
  };

  const commitTeamData = (current: AppState, next: AppState) => {
    const token = current.auth.token ?? current.backend.token;
    if (!token) {
      setState(next);
      return;
    }
    const sequence = ++commitSequence;
    setState({
      ...next,
      backend: {
        ...next.backend,
        status: "saving",
        message: "正在写入团队后台",
      },
    });
    commitQueue = commitQueue.then(async () => {
      await persistTeamData(current, next, {
        refreshAfterSave: true,
        canApplyState: () => sequence === commitSequence,
      });
    });
  };

  return { persistTeamData, commitTeamData };
};
