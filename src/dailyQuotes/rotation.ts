type CivilTime = { year: number; month: number; day: number; hour: number; minute: number; second: number };

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;
const anchor = Date.UTC(2026, 0, 1);
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-GB", {
      timeZone, calendar: "gregory", numberingSystem: "latn", hourCycle: "h23",
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    formatters.set(timeZone, value);
  }
  return value;
}

export function isTimeZone(value: string) {
  if (!/^[a-z][a-z0-9_+/-]*$/i.test(value)) return false;
  try {
    formatter(value);
    return true;
  } catch {
    return false;
  }
}

export const isRotationTime = (value: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);

function civilTime(timeZone: string, instant: number): CivilTime {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(instant).map(({ type, value }) => [type, Number(value)]));
  return { year: parts.year, month: parts.month, day: parts.day, hour: parts.hour % 24, minute: parts.minute, second: parts.second };
}

function utcCivilMillis({ year, month, day, hour, minute, second }: CivilTime) {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  date.setUTCHours(hour, minute, second, 0);
  return date.getTime();
}

// A UTC timestamp encodes the calendar fields here. It is not the instant in the selected zone.
function boundary(day: number, time: string, zone: string) {
  const [hour, minute] = time.split(":").map(Number);
  const wallTime = day + hour * HOUR_MS + minute * 60_000;
  const localMillis = (instant: number) => utcCivilMillis(civilTime(zone, instant));
  const before = wallTime - 36 * HOUR_MS;
  const after = wallTime + 36 * HOUR_MS;
  const offsets = new Set([before, wallTime, after].map((instant) => localMillis(instant) - instant));
  const candidates = [...offsets].map((offset) => wallTime - offset).sort((left, right) => left - right);
  const exact = candidates.find((instant) => localMillis(instant) === wallTime);
  if (exact !== undefined) return exact;

  // A skipped wall time belongs to the first valid second after the offset jump.
  let low = Math.floor(candidates[0] / 1000);
  let high = Math.ceil(candidates[candidates.length - 1] / 1000);
  while (high - low > 1) {
    const mid = Math.floor((high + low) / 2);
    if (localMillis(mid * 1000) < wallTime) low = mid;
    else high = mid;
  }
  return high * 1000;
}

export function quoteRotation(now: Date, time: string, zone: string, enabledCount: number) {
  const today = utcCivilMillis({ ...civilTime(zone, now.getTime()), hour: 0, minute: 0, second: 0 });
  const todayBoundary = boundary(today, time, zone);
  const tomorrow = today + DAY_MS;
  const tomorrowBoundary = boundary(tomorrow, time, zone);
  // A rollback just after midnight can cross into the previous wall date.
  // Keep the new quote if the first occurrence of its boundary already passed.
  let quoteDay = today - DAY_MS;
  let nextBoundary = todayBoundary;
  if (now.getTime() >= tomorrowBoundary) {
    quoteDay = tomorrow;
    nextBoundary = boundary(tomorrow + DAY_MS, time, zone);
  } else if (now.getTime() >= todayBoundary) {
    quoteDay = today;
    nextBoundary = tomorrowBoundary;
  }
  const daysFromAnchor = (quoteDay - anchor) / DAY_MS;
  return {
    index: enabledCount ? ((daysFromAnchor % enabledCount) + enabledCount) % enabledCount : undefined,
    next: new Date(nextBoundary),
  };
}
