import { useEffect } from "react";
import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan } from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { loadTeamBusinessState } from "./teamBusinessApi";

const TEAM_BUSINESS_REFRESH_MS = 5000;

export function useTeamBusinessRefresh({
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
        const next = await loadTeamBusinessState(current);
        if (!cancelled) setState(ensureTodayPlan(next));
      } catch (error) {
        if (!cancelled) setState((value) => (value ? applyTeamStateLoadFailure(value, error) : value));
      } finally {
        inFlight = false;
      }
    };
    const immediate = window.setTimeout(() => void refreshIfNeeded(), TEAM_BUSINESS_REFRESH_MS);
    const interval = window.setInterval(() => void refreshIfNeeded(), TEAM_BUSINESS_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [loaded, state?.auth.token, state?.sync.token, state?.sync.serverUrl]);
}

export function useTodayPlanRepair({
  state,
  commitBusinessState,
}: Pick<AppLifecycleHooksOptions, "state" | "commitBusinessState">) {
  useEffect(() => {
    if (!state) return;
    const repaired = ensureTodayPlan(state);
    if (repaired !== state) {
      commitBusinessState(state, repaired);
    }
  }, [state]);
}
