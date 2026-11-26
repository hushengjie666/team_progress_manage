import { describe, expect, it } from "vitest";
import { builtInQuotes } from "./builtInQuotes";
import { defaultQuoteSettings, quoteLibrary } from "./library";
import { isRotationTime, isTimeZone, quoteRotation } from "./rotation";

const rotation = (now: string, time = "00:00", zone = "UTC", count = 100) =>
  quoteRotation(new Date(now), time, zone, count);

describe("daily quote rotation", () => {
  it("visits every enabled quote once per cycle, starting on the fixed anchor", () => {
    const library = quoteLibrary(defaultQuoteSettings("UTC"));
    const ids = Array.from({ length: 101 }, (_, day) => {
      const at = new Date(Date.UTC(2026, 0, day + 1, 8));
      const { index } = quoteRotation(at, "08:00", "UTC", library.length);
      return library[index!].id;
    });
    expect(ids.slice(0, 100)).toEqual(builtInQuotes.map(({ id }) => id));
    expect(ids[100]).toBe(ids[0]);
    expect(rotation("2025-12-31T23:59:59.999Z").index).toBe(99);
  });

  it("uses real local calendar days across time zones, leap days and years", () => {
    expect(rotation("2026-01-01T00:00:00Z", "08:00", "Asia/Shanghai").index).toBe(0);
    expect(rotation("2026-01-01T00:00:00Z", "08:00", "UTC").index).toBe(99);
    expect(rotation("2026-01-01T07:59:59.999Z", "08:00").next.toISOString()).toBe("2026-01-01T08:00:00.000Z");
    expect(rotation("2026-01-01T08:00:00Z", "08:00").index).toBe(0);
    expect(rotation("2026-01-01T23:59:59.999Z", "08:00").index).toBe(0);
    expect(rotation("2027-01-01T00:00:00Z").index).toBe(65);
    expect(rotation("2028-02-28T00:00:00Z").index).toBe(88);
    expect(rotation("2028-02-29T00:00:00Z").index).toBe(89);
    expect(rotation("2028-03-01T00:00:00Z").index).toBe(90);
  });

  it("advances at the first valid instant when New York skips the planned time", () => {
    const before = rotation("2026-03-08T06:59:59.999Z", "02:30", "America/New_York");
    const after = rotation("2026-03-08T07:00:00Z", "02:30", "America/New_York");
    expect(before.next.toISOString()).toBe("2026-03-08T07:00:00.000Z");
    expect(after.index).toBe(before.index! + 1);
    expect(after.next.toISOString()).toBe("2026-03-09T06:30:00.000Z");
  });

  it("keeps the new quote through the repeated hour in New York", () => {
    const before = rotation("2026-11-01T05:29:59.999Z", "01:30", "America/New_York");
    const first = rotation("2026-11-01T05:30:00Z", "01:30", "America/New_York");
    const repeated = rotation("2026-11-01T06:00:00Z", "01:30", "America/New_York");
    expect(before.next.toISOString()).toBe("2026-11-01T05:30:00.000Z");
    expect(first.index).toBe(before.index! + 1);
    expect(repeated).toEqual(first);
    expect(rotation("2026-11-01T06:30:00Z", "01:30", "America/New_York")).toEqual(first);
  });

  it("does not retreat when a repeated hour rolls back into the previous date", () => {
    const before = rotation("2009-11-01T02:29:59.999Z", "00:00", "America/St_Johns");
    const first = rotation("2009-11-01T02:30:00Z", "00:00", "America/St_Johns");
    const afterRollback = rotation("2009-11-01T02:31:00Z", "00:00", "America/St_Johns");
    expect(before.next.toISOString()).toBe("2009-11-01T02:30:00.000Z");
    expect(first.index).toBe((before.index! + 1) % 100);
    expect(afterRollback).toEqual(first);
  });

  it("handles a half-hour daylight-saving transition", () => {
    const before = rotation("2026-10-03T15:29:59.999Z", "02:15", "Australia/Lord_Howe");
    const after = rotation("2026-10-03T15:30:00Z", "02:15", "Australia/Lord_Howe");
    expect(before.next.toISOString()).toBe("2026-10-03T15:30:00.000Z");
    expect(after.index).toBe(before.index! + 1);
  });

  it("calculates directly after days away and when the enabled pool changes", () => {
    expect(rotation("2026-01-06T09:00:00Z").index).toBe(5);
    expect(rotation("2026-01-06T09:00:00Z", "00:00", "UTC", 2).index).toBe(1);
    expect(rotation("2026-01-06T09:00:00Z", "00:00", "UTC", 1).index).toBe(0);
    expect(rotation("2026-01-06T09:00:00Z", "00:00", "UTC", 0).index).toBeUndefined();
  });

  it("accepts minute-precision schedules and recognized IANA zone names", () => {
    expect(["00:00", "08:37", "23:59"].every(isRotationTime)).toBe(true);
    expect(["24:00", "09:60", "8:37", ""].some(isRotationTime)).toBe(false);
    expect(["UTC", "Asia/Shanghai", "America/Argentina/Buenos_Aires"].every(isTimeZone)).toBe(true);
    expect(["Not/AZone", "+01:00", "UTC "].some(isTimeZone)).toBe(false);
  });
});
