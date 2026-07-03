import { describe, expect, it } from "vitest";
import { isCurrentAppStatePayload, parseCurrentAppStatePayload } from "./storage";
import { createInitialState } from "./test/fixtures";

describe("current app state payload", () => {
  it("accepts the complete current state shape", () => {
    const state = createInitialState();

    expect(isCurrentAppStatePayload(state)).toBe(true);
    expect(parseCurrentAppStatePayload(state)).toBe(state);
  });

  it("rejects unsupported schema versions instead of normalizing them", () => {
    const state = createInitialState();
    const legacy = { ...state, version: state.version - 1 };

    expect(isCurrentAppStatePayload(legacy)).toBe(false);
    expect(() => parseCurrentAppStatePayload(legacy)).toThrow("当前版本");
  });

  it("rejects incomplete current-version payloads instead of backfilling fields", () => {
    const state = createInitialState();
    const incomplete = { ...state };
    delete (incomplete as Partial<typeof state>).tasks;

    expect(isCurrentAppStatePayload(incomplete)).toBe(false);
    expect(() => parseCurrentAppStatePayload(incomplete)).toThrow("完整");
  });

  it("rejects payloads missing required sync tombstones", () => {
    const state = createInitialState();
    const sync = { ...state.sync };
    delete (sync as Partial<typeof sync>).tombstones;

    const incomplete = { ...state, sync };

    expect(isCurrentAppStatePayload(incomplete)).toBe(false);
    expect(() => parseCurrentAppStatePayload(incomplete)).toThrow("完整");
  });
});
