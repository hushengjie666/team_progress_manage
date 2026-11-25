import type { BackendConnectionState } from "../types";
import { apiUrl, authHeaders, requestJson } from "../teamBackendHttp";
import { submitTeamDomainCommand } from "../teamDomainCommands";
import { DAILY_QUOTES_SETTING } from "./accountSettingKey";
import { readQuoteSettings, type DailyQuoteSettings } from "./library";

const cacheKey = (serverUrl: string, accountId: string) =>
  `timemanage.daily-quotes.v1:${encodeURIComponent(apiUrl(serverUrl, ""))}:${encodeURIComponent(accountId)}`;

export function readCachedQuoteSettings(serverUrl: string, accountId: string) {
  if (!accountId) return {};
  try {
    const raw = localStorage.getItem(cacheKey(serverUrl, accountId));
    if (raw === null) return {};
    const settings = readQuoteSettings(JSON.parse(raw));
    return settings ? { settings } : { invalid: true };
  } catch {
    return { invalid: true };
  }
}

export function cacheQuoteSettings(serverUrl: string, accountId: string, settings: DailyQuoteSettings | null) {
  try {
    localStorage.setItem(cacheKey(serverUrl, accountId), JSON.stringify(settings));
  } catch {
    // The server is authoritative. The active session still has the confirmed settings.
  }
}

export async function loadAccountQuoteSettings(serverUrl: string, token: string) {
  const response = await requestJson<{ settings: Record<string, unknown> }>(apiUrl(serverUrl, "/settings"), {
    headers: authHeaders(token),
  }, { retry: true });
  if (!response?.settings || typeof response.settings !== "object" || Array.isArray(response.settings)) {
    throw new Error("无法读取账号设置");
  }
  return response.settings[DAILY_QUOTES_SETTING];
}

export async function saveAccountQuoteSettings(backend: BackendConnectionState, token: string, settings: DailyQuoteSettings) {
  const result = await submitTeamDomainCommand(backend, token, { kind: "settings", patch: { [DAILY_QUOTES_SETTING]: settings } });
  const confirmed = readQuoteSettings(result.settings[DAILY_QUOTES_SETTING]);
  if (!confirmed) throw new Error("后台未确认名言配置");
  return confirmed;
}
