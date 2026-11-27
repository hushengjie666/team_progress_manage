export const DAILY_QUOTES_SETTING = "dailyQuotes";
export const PET_SETTING = "focusPet";

/** These fields have their own per-server, per-account caches and PATCH writers. */
export function withoutAccountOwnedSettings<T extends object>(settings: T): T {
  if (!(DAILY_QUOTES_SETTING in settings || PET_SETTING in settings)) return settings;
  const rest = { ...settings };
  Reflect.deleteProperty(rest, DAILY_QUOTES_SETTING);
  Reflect.deleteProperty(rest, PET_SETTING);
  return rest;
}
