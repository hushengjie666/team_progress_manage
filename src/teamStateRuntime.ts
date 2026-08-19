import { applyTeamStateSaveFailure } from "./appBoot";
import { loadTeamData } from "./teamBusinessApi";
import { mergeBusinessRowChangesIntoState } from "./teamBusinessRows";
import { submitTeamDomainCommand, type RunTeamDomainCommand } from "./teamDomainCommands";
import type { AppState } from "./types";

export type TeamDataRuntimeOptions = {
  getState: () => AppState | null;
  setState: (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
  setToast: (message: string) => void;
};

export type TeamDataRuntime = {
  runTeamCommand: RunTeamDomainCommand;
};

export const createTeamDataRuntime = ({ getState, setState, setToast }: TeamDataRuntimeOptions): TeamDataRuntime => {
  let commandQueue = Promise.resolve<AppState | undefined>(undefined);

  const runTeamCommand: RunTeamDomainCommand = (command) => {
    commandQueue = commandQueue.then(async () => {
      const current = getState();
      const token = current?.auth.token ?? current?.backend.token;
      if (!current || !token) {
        setToast("请先连接团队后台");
        return undefined;
      }
      setState({
        ...current,
        backend: { ...current.backend, status: "saving", message: "正在执行业务操作" },
      });
      try {
        const result = await submitTeamDomainCommand(current.backend, token, command);
        const confirmedSource = getState() ?? current;
        const savedSource = {
          ...confirmedSource,
          backend: { ...confirmedSource.backend, lastSavedAt: new Date().toISOString(), failureKind: undefined },
        };
        const latest = result?.delta && result.rows
          ? mergeBusinessRowChangesIntoState(savedSource, result.rows)
          : await loadTeamData({
              ...savedSource,
            });
        setState(latest);
        return latest;
      } catch (error) {
        const failed = applyTeamStateSaveFailure(current, error);
        setState(failed);
        setToast(failed.backend.message);
        return undefined;
      }
    });
    return commandQueue;
  };

  return { runTeamCommand };
};
