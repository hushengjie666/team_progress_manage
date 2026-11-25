import { afterEach, describe, expect, it, vi } from "vitest";
import { cacheQuoteSettings, readCachedQuoteSettings } from "./accountSettings";
import { withoutDailyQuoteSettings } from "./accountSettingKey";
import { builtInQuotes } from "./builtInQuotes";
import { defaultQuoteSettings, normalizeQuoteText, quoteLibrary, readQuoteSettings, validateQuoteFields } from "./library";

const fields = { text: "新的个人名言", author: "本人", source: "", url: "" };
const defaults = defaultQuoteSettings("Asia/Shanghai");

afterEach(() => vi.unstubAllGlobals());

describe("daily quote library", () => {
  it("ships one hundred distinct and verified references with valid fields", () => {
    expect(builtInQuotes).toHaveLength(100);
    expect(new Set(builtInQuotes.map(({ id }) => id)).size).toBe(100);
    expect(new Set(builtInQuotes.map(({ text }) => normalizeQuoteText(text))).size).toBe(100);
    expect(quoteLibrary(defaults).every(({ enabled, kind }) => enabled && kind === "builtin")).toBe(true);
    for (const quote of builtInQuotes) {
      expect(validateQuoteFields(quote).error, quote.id).toBeUndefined();
      expect(quote.source, quote.id).toBeTruthy();
      expect(new URL(quote.url).protocol, quote.id).toBe("https:");
      expect(Boolean(quote.original), quote.id).toBe(Boolean(quote.translation));
    }
  });

  it("validates trimmed code points, normalized duplicates and reference protocols", () => {
    const library = quoteLibrary({ ...defaults, custom: [{ ...fields, id: "custom-1", text: "ABC   测试" }] });
    expect(validateQuoteFields({ ...fields, text: "　 " }).error).toMatch(/正文/);
    expect(validateQuoteFields({ ...fields, text: "𠮷".repeat(80) }).value?.text).toHaveLength(160);
    expect(validateQuoteFields({ ...fields, text: "𠮷".repeat(81) }).error).toMatch(/正文/);
    expect(validateQuoteFields({ ...fields, author: " ".repeat(50) }).error).toMatch(/作者/);
    expect(validateQuoteFields({ ...fields, source: "字".repeat(121) }).error).toMatch(/出处/);
    expect(validateQuoteFields({ ...fields, url: "javascript:alert(1)" }).error).toMatch(/链接/);
    expect(validateQuoteFields({ ...fields, url: " http://example.test/source " }).value?.url).toBe("http://example.test/source");
    expect(validateQuoteFields({ ...fields, text: "　ａｂｃ 测试 " }, library).error).toMatch(/相同正文/);
    expect(validateQuoteFields({ ...fields, text: "　ａｂｃ 测试 " }, library, "custom-1").error).toBeUndefined();
  });

  it("keeps order, removes verified metadata from overrides and isolates the original seed", () => {
    const translated = builtInQuotes.find(({ original }) => original)!;
    const config = {
      ...defaults, disabled: [translated.id],
      overrides: { [translated.id]: fields },
      custom: [{ ...fields, text: "最后一条", id: "custom-1" }, { ...fields, text: "后来一条", id: "custom-2" }],
    };
    const library = quoteLibrary(config);
    expect(library.slice(0, 100).map(({ id }) => id)).toEqual(builtInQuotes.map(({ id }) => id));
    expect(library.find(({ id }) => id === translated.id)).toEqual({ ...fields, id: translated.id, enabled: false, kind: "modified" });
    expect(library.slice(-2).map(({ id }) => id)).toEqual(["custom-1", "custom-2"]);
    expect(quoteLibrary(defaults).find(({ id }) => id === translated.id)).toMatchObject({ original: translated.original, enabled: true, kind: "builtin" });
  });

  it("accepts valid snapshots and safely rejects legacy or corrupt settings", () => {
    expect(readQuoteSettings(defaults)).toEqual(defaults);
    expect(defaultQuoteSettings("Not/AZone")).toMatchObject({ time: "00:00", timeZone: "UTC", fallbackTimeZone: true });
    for (const raw of [undefined, null, { ...defaults, time: "23:60" }, { ...defaults, timeZone: "bad" },
      { ...defaults, disabled: ["foreign"] }, { ...defaults, overrides: { "builtin-001": { ...fields, url: "data:text/html," } } },
      { ...defaults, custom: [{ ...fields, id: "custom-1", text: builtInQuotes[0].text }] }]) {
      expect(readQuoteSettings(raw)).toBeUndefined();
    }
    expect(withoutDailyQuoteSettings({ dailyQuotes: defaults, focusMinutes: 25 })).toEqual({ focusMinutes: 25 });
  });

  it("keys cached settings by backend and account, with separate invalid and missing states", () => {
    const cache = new Map<string, string>();
    vi.stubGlobal("localStorage", { getItem: (key: string) => cache.get(key) ?? null, setItem: (key: string, value: string) => cache.set(key, value) });
    cacheQuoteSettings("https://example.test/", "account-1", defaults);
    expect(readCachedQuoteSettings("https://example.test", "account-1")).toEqual({ settings: defaults });
    expect(readCachedQuoteSettings("https://example.test", "account-2")).toEqual({});
    expect(readCachedQuoteSettings("https://other.test", "account-1")).toEqual({});
    cache.set([...cache.keys()][0], "{corrupt");
    expect(readCachedQuoteSettings("https://example.test", "account-1")).toEqual({ invalid: true });
  });
});
