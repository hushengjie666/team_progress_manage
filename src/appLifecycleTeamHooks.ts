import { useEffect } from "react";
import { applyTeamStateLoadFailure } from "./appBoot";
import { ensureTodayPlan } from "./appModel";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { loadTeamData } from "./teamBusinessApi";

const TEAM_BUSINESS_REFRESH_MS = 5000;
const TEAM_BUSINESS_MAX_RETRY_MS = 60_000;

export const teamBusinessRefreshDelay = (failureCount: number) =>
  Math.min(TEAM_BUSINESS_REFRESH_MS * (2 ** Math.max(0, failureCount)), TEAM_BUSINESS_MAX_RETRY_MS);

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
    let failureCount = 0;
    let refreshTimer: number | undefined;
    const scheduleRefresh = (delay: number) => {
      refreshTimer = window.setTimeout(() => void refreshIfNeeded(), delay);
    };
    const refreshIfNeeded = async () => {
      if (cancelled || inFlight) return;
      const current = stateRef.current;
      const currentToken = current?.auth.token ?? current?.backend.token;
      if (!current || !currentToken) return;
      inFlight = true;
      try {
        const next = await loadTeamData(current);
        failureCount = 0;
        if (!cancelled) setState(ensureTodayPlan(next));
      } catch (error) {
        failureCount += 1;
        if (!cancelled) setState((value) => (value ? applyTeamStateLoadFailure(value, error) : value));
      } finally {
        inFlight = false;
        if (!cancelled) scheduleRefresh(teamBusinessRefreshDelay(failureCount));
      }
    };
    scheduleRefresh(TEAM_BUSINESS_REFRESH_MS);
    return () => {
      cancelled = true;
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
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
