import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { BackendConnectionState } from "../types";
import {
  cacheQuoteSettings, loadAccountQuoteSettings, readCachedQuoteSettings, saveAccountQuoteSettings,
} from "./accountSettings";
import { defaultQuoteSettings, quoteLibrary, readQuoteSettings, type DailyQuoteSettings } from "./library";
import { quoteRotation } from "./rotation";

type AccountQuotes = {
  settings: DailyQuoteSettings;
  warning?: string;
  busy: boolean;
  reload: () => Promise<boolean>;
  save: (settings: DailyQuoteSettings) => Promise<boolean>;
};

const QuoteContext = createContext<AccountQuotes | null>(null);

export function DailyQuotesProvider({ accountId, token, backend, children }: {
  accountId: string;
  token?: string;
  backend: BackendConnectionState;
  children: ReactNode;
}) {
  const { serverUrl, lastLoadedAt } = backend;
  const [defaults] = useState(defaultQuoteSettings);
  const [snapshot, setSnapshot] = useState(() => {
    const cached = readCachedQuoteSettings(serverUrl, accountId);
    return { settings: cached.settings ?? defaults, warning: cached.invalid ? "缓存中的名言配置异常，已使用原始名言库。" : undefined };
  });
  const [busy, setBusy] = useState(Boolean(token && accountId));
  const active = useRef(false);
  const operation = useRef(false);

  async function run(update?: DailyQuoteSettings) {
    if (!token || !accountId || operation.current) return false;
    operation.current = true;
    setBusy(true);
    try {
      let settings: DailyQuoteSettings | undefined;
      if (update) {
        settings = await saveAccountQuoteSettings(backend, token, update);
      } else {
        const raw = await loadAccountQuoteSettings(serverUrl, token);
        if (!active.current) return false;
        settings = raw === undefined
          ? await saveAccountQuoteSettings(backend, token, defaults)
          : readQuoteSettings(raw);
      }
      if (!active.current) return false;
      if (settings) {
        cacheQuoteSettings(serverUrl, accountId, settings);
        setSnapshot({ settings, warning: undefined });
      } else {
        // Keep the corrupt value on the server until the user explicitly saves a replacement.
        cacheQuoteSettings(serverUrl, accountId, null);
        setSnapshot({ settings: defaults, warning: "名言配置异常，已使用原始名言库。保存后将替换该账号的名言配置。" });
      }
      return true;
    } catch {
      if (active.current && !update) setSnapshot((current) => ({
        ...current, warning: current.warning ?? "暂时无法刷新名言配置，正在使用此设备已有的配置或默认名言库。",
      }));
      return false;
    } finally {
      operation.current = false;
      if (active.current) setBusy(false);
    }
  }

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  useEffect(() => {
    void run();
  }, [accountId, serverUrl, token, lastLoadedAt]);

  return (
    <QuoteContext.Provider value={{ ...snapshot, busy, reload: () => run(), save: (settings) => run(settings) }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useAccountQuotes() {
  const account = useContext(QuoteContext);
  if (!account) throw new Error("每日名言需要账号设置上下文");
  return account;
}

export function useDailyQuote() {
  const { settings } = useAccountQuotes();
  const [now, setNow] = useState(() => new Date());
  const library = useMemo(() => quoteLibrary(settings), [settings]);
  const enabled = useMemo(() => library.filter((quote) => quote.enabled), [library]);

  useEffect(() => {
    const refresh = () => setNow(new Date());
    refresh();
    const timer = window.setInterval(refresh, 20_000);
    const onVisible = () => { if (!document.hidden) refresh(); };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [settings]);

  const rotation = useMemo(
    () => quoteRotation(now, settings.time, settings.timeZone, enabled.length),
    [now, settings.time, settings.timeZone, enabled.length],
  );
  return {
    library, enabledCount: enabled.length, next: rotation.next,
    quote: rotation.index === undefined ? undefined : enabled[rotation.index],
  };
}
