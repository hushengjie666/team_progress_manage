export const DAILY_QUOTES_SETTING = "dailyQuotes";

/** The account-scoped quote cache owns this field. Other settings still use the shared runtime. */
export function withoutDailyQuoteSettings<T extends object>(settings: T): T {
  if (!Object.prototype.hasOwnProperty.call(settings, DAILY_QUOTES_SETTING)) return settings;
  const rest = { ...settings };
  Reflect.deleteProperty(rest, DAILY_QUOTES_SETTING);
  return rest;
}
