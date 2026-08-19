import { applyTeamStateSaveFailure } from "./appBoot";
import { mergeBusinessRowChangesIntoState } from "./teamBusinessRows";
import {
  submitTeamDomainCommand,
  type RunTeamDomainCommand,
  type TeamDomainCommand,
  type TeamMutationBehavior,
} from "./teamDomainCommands";
import type { AppState, Settings } from "./types";

export type TeamDataRuntimeOptions = {
  getState: () => AppState | null;
  setState: (updater: AppState | null | ((current: AppState | null) => AppState | null)) => void;
  setToast: (message: string) => void;
};

export type TeamDataRuntime = {
  runTeamCommand: RunTeamDomainCommand;
};

const defaultResourceKey = (command: TeamDomainCommand) => {
  if (command.kind === "settings") return "settings:account";
  if (command.kind === "action") return `${command.resource}:${command.id}`;
  if (command.kind === "create") {
    const id = typeof command.payload.id === "string" ? command.payload.id : "new";
    return `${command.entity}:${id}`;
  }
  return `${command.entity}:${command.id}`;
};

const defaultPendingMode = (command: TeamDomainCommand): TeamMutationBehavior["pendingMode"] => {
  if (command.kind === "delete") return "blocking";
  if (command.kind === "action" && ["submit-review", "accept-review", "return-review", "move"].includes(command.action)) {
    return "blocking";
  }
  return "background";
};

const withPendingResource = (state: AppState, resourceKey: string, pending: boolean): AppState => {
  const current = state.backend.pendingResourceKeys ?? [];
  const next = pending
    ? current.includes(resourceKey) ? current : [...current, resourceKey]
    : current.filter((key) => key !== resourceKey);
  return {
    ...state,
    backend: {
      ...state.backend,
      pendingResourceKeys: next,
      message: pending ? "正在保存变更" : state.backend.message,
    },
  };
};

export const createTeamDataRuntime = ({ getState, setState, setToast }: TeamDataRuntimeOptions): TeamDataRuntime => {
  const resourceQueues = new Map<string, Promise<AppState | undefined>>();
  const slotWaiters: Array<() => void> = [];
  let activeCount = 0;

  const acquireSlot = async () => {
    if (activeCount < 4) {
      activeCount += 1;
      return;
    }
    await new Promise<void>((resolve) => slotWaiters.push(resolve));
    activeCount += 1;
  };

  const releaseSlot = () => {
    activeCount = Math.max(0, activeCount - 1);
    slotWaiters.shift()?.();
  };

  const enqueue = (resourceKey: string, execute: () => Promise<AppState | undefined>) => {
    const previous = resourceQueues.get(resourceKey) ?? Promise.resolve(undefined);
    const queued = previous.catch(() => undefined).then(async () => {
      await acquireSlot();
      try {
        return await execute();
      } finally {
        releaseSlot();
      }
    });
    resourceQueues.set(resourceKey, queued);
    void queued.finally(() => {
      if (resourceQueues.get(resourceKey) === queued) resourceQueues.delete(resourceKey);
    });
    return queued;
  };

  const runTeamCommand: RunTeamDomainCommand = (command, suppliedBehavior) => {
    const initial = getState();
    const token = initial?.auth.token ?? initial?.backend.token;
    if (!initial || !token) {
      setToast("请先连接团队后台");
      return Promise.resolve(undefined);
    }

    const behavior: TeamMutationBehavior = suppliedBehavior ?? {
      resourceKey: defaultResourceKey(command),
      pendingMode: defaultPendingMode(command),
    };
    const optimistic = behavior.optimistic?.(initial);
    setState(withPendingResource(optimistic?.next ?? initial, behavior.resourceKey, true));

    return enqueue(behavior.resourceKey, async () => {
      const current = getState();
      const currentToken = current?.auth.token ?? current?.backend.token;
      if (!current || !currentToken) return undefined;
      try {
        const result = await submitTeamDomainCommand(current.backend, currentToken, command);
        const confirmedSource = getState();
        if (!confirmedSource) return undefined;
        const merged = mergeBusinessRowChangesIntoState(confirmedSource, result.rows, result.deleted);
        const withSettings = Object.keys(result.settings).length > 0
          ? { ...merged, settings: { ...merged.settings, ...result.settings } as Settings }
          : merged;
        const saved = withPendingResource(withSettings, behavior.resourceKey, false);
        setState(saved);
        return saved;
      } catch (error) {
        const latest = getState();
        if (!latest) return undefined;
        const rolledBack = optimistic ? optimistic.rollback(latest) : latest;
        const withoutPending = withPendingResource(rolledBack, behavior.resourceKey, false);
        const failedState = applyTeamStateSaveFailure(withoutPending, error);
        setState(failedState);
        setToast(failedState.backend.message);
        return undefined;
      }
    });
  };

  return { runTeamCommand };
};
