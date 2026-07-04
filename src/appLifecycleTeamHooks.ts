import { useEffect } from "react";
import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan } from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { loadTeamData } from "./teamBusinessApi";

const TEAM_BUSINESS_REFRESH_MS = 5000;

export function useTeamBusinessRefresh({
  state,
  loaded,
  stateRef,
  setState,
}: Pick<AppLifecycleHooksOptions, "state" | "loaded" | "stateRef" | "setState">) {
  useEffect(() => {
    const token = state?.auth.token ?? state?.backend.token;
    if (!loaded || !state || !token) return;
    let cancelled = false;
    let inFlight = false;
    const refreshIfNeeded = async () => {
      if (cancelled || inFlight) return;
      const current = stateRef.current;
      const currentToken = current?.auth.token ?? current?.backend.token;
      if (!current || !currentToken) return;
      inFlight = true;
      try {
        const next = await loadTeamData(current);
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
  }, [loaded, state?.auth.token, state?.backend.token, state?.backend.serverUrl]);
}

export function useTodayPlanRepair({
  state,
  commitTeamData,
}: Pick<AppLifecycleHooksOptions, "state" | "commitTeamData">) {
  useEffect(() => {
    if (!state) return;
    const repaired = ensureTodayPlan(state);
    if (repaired !== state) {
      commitTeamData(state, repaired);
    }
  }, [state]);
}
