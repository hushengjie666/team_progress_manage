import { useEffect } from "react";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";
import { preserveLocalUnpersistedTimer } from "./teamActiveRuntimePreservation";
import { apiUrl, authHeaders, requestJson } from "./teamBackendHttp";
import { loadTeamData } from "./teamBusinessApi";
import { mergeBusinessRowChangesIntoState, type BusinessDeletedRow, type BusinessRow } from "./teamBusinessRows";
import type { AppState, Settings } from "./types";

const REALTIME_RECONNECT_DELAYS_MS = [1_000, 2_000, 5_000, 10_000, 30_000];
const REALTIME_DEGRADED_AFTER_MS = 30_000;
const REALTIME_DEGRADED_REFRESH_MS = 60_000;

type RealtimeTicketResponse = {
  ticket: string;
  expires_at: string;
};

type RealtimeDelta = {
  mutation_id: string;
  delta: true;
  rows: BusinessRow[];
  deleted: BusinessDeletedRow[];
  settings: Record<string, unknown>;
  server_time: string;
};

type RealtimeEvent = {
  type: "business_delta" | "metadata_changed" | "resync_required" | "heartbeat";
  payload?: RealtimeDelta;
};

export const teamRealtimeReconnectDelay = (failureCount: number) =>
  REALTIME_RECONNECT_DELAYS_MS[Math.min(Math.max(0, failureCount), REALTIME_RECONNECT_DELAYS_MS.length - 1)];

export const teamBusinessRefreshDelay = teamRealtimeReconnectDelay;

export const mergeTeamBusinessRefreshState = (remote: AppState, current: AppState, now = new Date()) =>
  preserveLocalUnpersistedTimer(remote, current, now);

const realtimeSocketUrl = (serverUrl: string, ticket: string) => {
  const url = new URL(apiUrl(serverUrl, "/app/events"));
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.searchParams.set("ticket", ticket);
  return url.toString();
};

export function useTeamBusinessRefresh({
  state,
  loaded,
  stateRef,
  setState,
}: Pick<AppLifecycleHooksOptions, "state" | "loaded" | "stateRef" | "setState">) {
  useEffect(() => {
    const token = state?.auth.token ?? state?.backend.token;
    if (!loaded || !state || !token || state.backend.status === "incompatible" || typeof WebSocket === "undefined") return;

    let cancelled = false;
    let socket: WebSocket | undefined;
    let reconnectTimer: number | undefined;
    let degradedTimer: number | undefined;
    let degradedRefreshTimer: number | undefined;
    let reconnectCount = 0;
    let hasConnected = false;
    let forceResync = false;
    let refreshing = false;
    const appliedMutationIds = new Set<string>();

    const setRealtimeStatus = (realtimeStatus: "connected" | "reconnecting" | "degraded") => {
      if (cancelled) return;
      setState((value) => value ? { ...value, backend: { ...value.backend, realtimeStatus } } : value);
    };

    const fullRefresh = async () => {
      if (cancelled || refreshing) return;
      const current = stateRef.current;
      if (!current) return;
      refreshing = true;
      try {
        const remote = await loadTeamData(current);
        if (!cancelled) setState((value) => value ? mergeTeamBusinessRefreshState(remote, value) : remote);
      } catch {
        if (!cancelled) setRealtimeStatus("degraded");
      } finally {
        refreshing = false;
      }
    };

    const stopDegradedMode = () => {
      if (degradedTimer !== undefined) window.clearTimeout(degradedTimer);
      if (degradedRefreshTimer !== undefined) window.clearInterval(degradedRefreshTimer);
      degradedTimer = undefined;
      degradedRefreshTimer = undefined;
    };

    const startDegradedCountdown = () => {
      if (degradedTimer !== undefined || degradedRefreshTimer !== undefined) return;
      degradedTimer = window.setTimeout(() => {
        degradedTimer = undefined;
        setRealtimeStatus("degraded");
        void fullRefresh();
        degradedRefreshTimer = window.setInterval(() => void fullRefresh(), REALTIME_DEGRADED_REFRESH_MS);
      }, REALTIME_DEGRADED_AFTER_MS);
    };

    const applyDelta = (delta: RealtimeDelta) => {
      if (!delta || delta.delta !== true || !Array.isArray(delta.rows) || !Array.isArray(delta.deleted)) {
        forceResync = true;
        socket?.close();
        return;
      }
      if (delta.mutation_id && appliedMutationIds.has(delta.mutation_id)) return;
      if (delta.mutation_id) {
        appliedMutationIds.add(delta.mutation_id);
        if (appliedMutationIds.size > 500) appliedMutationIds.delete(appliedMutationIds.values().next().value as string);
      }
      setState((value) => {
        if (!value) return value;
        const merged = mergeBusinessRowChangesIntoState(value, delta.rows, delta.deleted, delta.server_time);
        return Object.keys(delta.settings ?? {}).length > 0
          ? { ...merged, settings: { ...merged.settings, ...delta.settings } as Settings }
          : merged;
      });
    };

    const scheduleReconnect = () => {
      if (cancelled || reconnectTimer !== undefined) return;
      setRealtimeStatus("reconnecting");
      startDegradedCountdown();
      const delay = teamRealtimeReconnectDelay(reconnectCount);
      reconnectCount += 1;
      reconnectTimer = window.setTimeout(() => {
        reconnectTimer = undefined;
        void connect();
      }, delay);
    };

    const connect = async () => {
      const current = stateRef.current;
      const currentToken = current?.auth.token ?? current?.backend.token;
      if (cancelled || !current || !currentToken) return;
      try {
        const ticket = await requestJson<RealtimeTicketResponse>(apiUrl(current.backend.serverUrl, "/app/events/ticket"), {
          method: "POST",
          headers: authHeaders(currentToken),
        });
        if (cancelled) return;
        socket = new WebSocket(realtimeSocketUrl(current.backend.serverUrl, ticket.ticket));
        socket.onopen = () => {
          const shouldRefresh = hasConnected || forceResync;
          hasConnected = true;
          forceResync = false;
          reconnectCount = 0;
          stopDegradedMode();
          setRealtimeStatus("connected");
          if (shouldRefresh) void fullRefresh();
        };
        socket.onmessage = (message) => {
          try {
            const event = JSON.parse(String(message.data)) as RealtimeEvent;
            if (event.type === "business_delta" && event.payload) applyDelta(event.payload);
            if (event.type === "metadata_changed") void fullRefresh();
            if (event.type === "resync_required") {
              forceResync = true;
              socket?.close();
            }
          } catch {
            forceResync = true;
            socket?.close();
          }
        };
        socket.onerror = () => socket?.close();
        socket.onclose = () => {
          socket = undefined;
          scheduleReconnect();
        };
      } catch {
        scheduleReconnect();
      }
    };

    setRealtimeStatus("reconnecting");
    void connect();
    return () => {
      cancelled = true;
      if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
      stopDegradedMode();
      if (socket) {
        socket.onclose = null;
        socket.close();
      }
    };
  }, [loaded, state?.auth.token, state?.backend.token, state?.backend.serverUrl]);
}
