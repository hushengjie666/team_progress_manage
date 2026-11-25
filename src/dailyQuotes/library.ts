import { builtInQuotes } from "./builtInQuotes";
import { isRotationTime, isTimeZone } from "./rotation";

export type QuoteFields = { text: string; author: string; source: string; url: string };
export type BuiltInQuote = QuoteFields & { id: string; original?: string; translation?: string };
type CustomQuote = QuoteFields & { id: string };
export type LibraryQuote = BuiltInQuote & { kind: "builtin" | "modified" | "custom"; enabled: boolean };
export type DailyQuoteSettings = {
  version: 1;
  time: string;
  timeZone: string;
  fallbackTimeZone: boolean;
  disabled: string[];
  overrides: Record<string, QuoteFields>;
  custom: CustomQuote[];
};

const nativeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
export function defaultQuoteSettings(deviceZone = nativeZone()): DailyQuoteSettings {
  const recognized = Boolean(deviceZone) && isTimeZone(deviceZone);
  return {
    version: 1, time: "00:00", timeZone: recognized ? deviceZone : "UTC", fallbackTimeZone: !recognized,
    disabled: [], overrides: {}, custom: [],
  };
}

export function quoteLibrary(settings: DailyQuoteSettings): LibraryQuote[] {
  const disabled = new Set(settings.disabled);
  return [
    ...builtInQuotes.map((quote): LibraryQuote => {
      const override = settings.overrides[quote.id];
      return override
        ? { ...override, id: quote.id, kind: "modified", enabled: !disabled.has(quote.id) }
        : { ...quote, kind: "builtin", enabled: !disabled.has(quote.id) };
    }),
    ...settings.custom.map((quote): LibraryQuote => ({ ...quote, kind: "custom", enabled: !disabled.has(quote.id) })),
  ];
}

export const quoteSourceStatus = (kind: LibraryQuote["kind"]) => ({
  builtin: "原始内置 · 出处已核实",
  modified: "内置 · 个人修改，出处未重新核实",
  custom: "用户自定义，出处未核实",
})[kind];

export const normalizeQuoteText = (text: string) => text.normalize("NFKC").trim().replace(/\s+/gu, " ").toLowerCase();

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function isReferenceUrl(value: string) {
  if (!/^https?:\/\//i.test(value)) return false;
  try {
    return Boolean(new URL(value).hostname);
  } catch {
    return false;
  }
}

export function validateQuoteFields(fields: QuoteFields, library: readonly LibraryQuote[] = [], excludeId?: string) {
  const value = { text: fields.text.trim(), author: fields.author.trim(), source: fields.source.trim(), url: fields.url.trim() };
  if (!value.text || [...value.text].length > 80) return { error: "正文须为 1–80 个字符，且不能只有空白。" };
  if (!value.author || [...value.author].length > 40) return { error: "作者或归属须为 1–40 个字符。" };
  if ([...value.source].length > 120) return { error: "出处说明最多 120 个字符。" };
  if (value.url && !isReferenceUrl(value.url)) return { error: "参考链接须为有效的 http 或 https 地址。" };
  const normalized = normalizeQuoteText(value.text);
  if (library.some((entry) => entry.id !== excludeId && normalizeQuoteText(entry.text) === normalized)) {
    return { error: "已有相同正文的名言，请修改正文。" };
  }
  return { value };
}

function readFields(raw: unknown) {
  if (!record(raw) || typeof raw.text !== "string" || typeof raw.author !== "string" ||
    typeof raw.source !== "string" || typeof raw.url !== "string") return undefined;
  return validateQuoteFields({ text: raw.text, author: raw.author, source: raw.source, url: raw.url }).value;
}

const builtInIds = new Set(builtInQuotes.map((quote) => quote.id));

export function readQuoteSettings(raw: unknown): DailyQuoteSettings | undefined {
  if (!record(raw) || raw.version !== 1 || typeof raw.time !== "string" || !isRotationTime(raw.time) ||
    typeof raw.timeZone !== "string" || !isTimeZone(raw.timeZone) || typeof raw.fallbackTimeZone !== "boolean" ||
    !Array.isArray(raw.disabled) || !record(raw.overrides) || !Array.isArray(raw.custom)) return undefined;

  const overrides: Record<string, QuoteFields> = {};
  for (const [id, entry] of Object.entries(raw.overrides)) {
    const fields = readFields(entry);
    if (!builtInIds.has(id) || !fields) return undefined;
    overrides[id] = fields;
  }

  const ids = new Set(builtInIds);
  const custom: CustomQuote[] = [];
  for (const entry of raw.custom) {
    const fields = readFields(entry);
    if (!record(entry) || typeof entry.id !== "string" || !/^custom-[a-z0-9-]+$/.test(entry.id) || ids.has(entry.id) || !fields) {
      return undefined;
    }
    ids.add(entry.id);
    custom.push({ ...fields, id: entry.id });
  }
  if (raw.disabled.some((id) => !ids.has(id))) return undefined;
  const settings: DailyQuoteSettings = {
    version: 1, time: raw.time, timeZone: raw.timeZone, fallbackTimeZone: raw.fallbackTimeZone,
    overrides, custom, disabled: [...new Set<string>(raw.disabled)],
  };
  const library = quoteLibrary(settings);
  if (new Set(library.map((entry) => normalizeQuoteText(entry.text))).size !== library.length) return undefined;
  return settings;
}
