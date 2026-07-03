import { useEffect } from "react";
import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan } from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { getTeamRevision, loadTeamState } from "./teamApi";

const TEAM_REVISION_POLL_MS = 1000;

export function useTeamRevisionPolling({
  state,
  loaded,
  stateRef,
  setState,
}: Pick<AppLifecycleHooksOptions, "state" | "loaded" | "stateRef" | "setState">) {
  useEffect(() => {
    const token = state?.auth.token ?? state?.sync.token;
    if (!loaded || !state || !token) return;
    let cancelled = false;
    let inFlight = false;
    const refreshIfNeeded = async () => {
      if (cancelled || inFlight) return;
      const current = stateRef.current;
      const currentToken = current?.auth.token ?? current?.sync.token;
      if (!current || !currentToken) return;
      inFlight = true;
      try {
        const revision = await getTeamRevision(current.sync, currentToken);
        if (cancelled || revision <= current.sync.lastPulledRevision) return;
        const next = await loadTeamState(current);
        if (!cancelled) setState(ensureTodayPlan(next));
      } catch (error) {
        if (!cancelled) setState((value) => (value ? applyTeamStateLoadFailure(value, error) : value));
      } finally {
        inFlight = false;
      }
    };
    const immediate = window.setTimeout(() => void refreshIfNeeded(), TEAM_REVISION_POLL_MS);
    const interval = window.setInterval(() => void refreshIfNeeded(), TEAM_REVISION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [loaded, state?.auth.token, state?.sync.token, state?.sync.serverUrl]);
}

export function useTodayPlanRepair({
  state,
  commitTeamState,
}: Pick<AppLifecycleHooksOptions, "state" | "commitTeamState">) {
  useEffect(() => {
    if (!state) return;
    const repaired = ensureTodayPlan(state);
    if (repaired !== state) {
      commitTeamState(state, repaired);
    }
  }, [state]);
}
