import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import type { AppState } from "../types";
import { condition, type PetAction } from "./model";
import { PetStore } from "./store";
import { PetWidget } from "./PetWidget";
import type { Mood } from "./PetPortrait";

/** Mounted for the authenticated account so switching pages never interrupts focus credit. */
export function FocusPet({ app, visible }: { app: AppState; visible: boolean }) {
  const [, changed] = useReducer(n => n + 1, 0);
  const [store] = useState(() => new PetStore(app.backend, app.auth.account?.id ?? "", app.auth.token ?? "", changed));
  const [time, setTime] = useState(Date.now);
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [warning, setWarning] = useState("");
  const [fedAt, setFedAt] = useState(0);
  const [coinFlash, setCoinFlash] = useState(false);
  const previous = useRef(store.state);
  const timer = useRef(app.activeTimer);
  const at = Date.now();
  const send = useCallback(async (action: PetAction) => {
    if (pending.current) return false;
    pending.current = true;
    setBusy(true);
    try {
      const saved = await store.action(action, Date.now());
      if (saved && (action.kind === "feed" || (action.kind === "buyFood" && action.serve))) setFedAt(Date.now());
      setWarning(saved ? "" : "状态已更新，请查看当前余额和物品。");
      setTime(Date.now());
      return saved;
    } catch {
      setWarning("未能确认保存，请检查连接后重试。");
      return false;
    } finally { pending.current = false; setBusy(false); }
  }, [store]);
  useEffect(() => {
    let live = true;
    const refresh = () => { void store.refresh().then(() => {
      if (live) { setWarning(""); store.observe(timer.current, Date.now(), true); }
    }).catch(() => { if (live) setWarning("暂时无法连接后台，正在展示本机宠物存档。"); }); };
    refresh();
    const sync = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    return () => {
      live = false; clearInterval(sync);
      window.removeEventListener("focus", refresh); window.removeEventListener("online", refresh);
    };
  }, [store]);
  useEffect(() => {
    const next = app.activeTimer;
    const old = timer.current;
    const now = Date.now();
    if (old?.isRunning && (old.sessionId !== next?.sessionId || old.startedAt !== next?.startedAt)) {
      const endedAt = app.focusSessions.find(s => s.id === old.sessionId)?.endedAt;
      store.observe(old, endedAt ? Math.min(now, Date.parse(endedAt)) : now, true);
    }
    timer.current = next;
    store.observe(next, now, !next?.isRunning);
  }, [store, app.activeTimer, app.focusSessions]);
  useEffect(() => {
    const tick = () => {
      const now = Date.now();
      store.observe(timer.current, now);
      if (visible) setTime(now);
    };
    const flush = () => store.observe(timer.current, Date.now(), true);
    tick();
    const id = window.setInterval(tick, 1000);
    window.addEventListener("pagehide", flush);
    return () => { clearInterval(id); window.removeEventListener("pagehide", flush); };
  }, [visible, store]);
  const state = store.state;
  useEffect(() => {
    const before = previous.current;
    previous.current = state;
    if (!before.pet || before.pet.born !== state.pet?.born || before.coins >= state.coins) return;
    setCoinFlash(true);
    const id = window.setTimeout(() => setCoinFlash(false), 1300);
    return () => { clearTimeout(id); setCoinFlash(false); };
  }, [state]);
  if (!visible) return null;
  const { fullness, dead } = condition(state, time);
  const mood: Mood = dead ? "dead" : fullness === 0 ? "crisis" : at - fedAt < 3000 ? "eating" :
    app.activeTimer?.mode === "focus" && app.activeTimer.isRunning ? "focus" : fullness < 50 ? "hungry" : "happy";
  return <PetWidget {...{ state, time, mood, busy, send, warning, coinFlash }}/>;
}
