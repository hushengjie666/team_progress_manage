import { describe, expect, it } from "vitest";
import { isCurrentAppStatePayload, parseCurrentAppStatePayload } from "./storage";
import { createInitialState } from "./test/fixtures";

describe("current app state payload", () => {
  it("accepts the runtime cache shape without business data", () => {
    const state = createInitialState();
    const payload = {
      version: 4,
      settings: state.settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
        token: state.backend.token,
      },
      updatedAt: state.updatedAt,
    };

    expect(isCurrentAppStatePayload(payload)).toBe(true);
    expect(parseCurrentAppStatePayload(payload)).toMatchObject({
      settings: state.settings,
      auth: state.auth,
      projects: expect.any(Array),
      tasks: [],
      dailyPlans: [],
    });
  });

  it("does not restore business arrays from cached payloads", () => {
    const state = createInitialState();
    const parsed = parseCurrentAppStatePayload({
      version: 4,
      settings: state.settings,
      auth: state.auth,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      projects: [{ id: "cached_project" }],
      tasks: [{ id: "cached_task" }],
      dailyPlans: [{ id: "cached_plan" }],
      updatedAt: state.updatedAt,
    });

    expect(parsed.projects).toEqual(createInitialState().projects);
    expect(parsed.tasks).toEqual([]);
    expect(parsed.dailyPlans).toEqual([]);
  });

  it("rejects unsupported schema versions instead of normalizing them", () => {
    const state = createInitialState();
    const legacy = { ...state, version: 2 };

    expect(isCurrentAppStatePayload(legacy)).toBe(false);
    expect(() => parseCurrentAppStatePayload(legacy)).toThrow("当前版本");
  });

  it("rejects runtime caches missing required auth", () => {
    const state = createInitialState();
    const incomplete = {
      version: 4,
      settings: state.settings,
      backend: {
        serverUrl: state.backend.serverUrl,
        username: state.backend.username,
        deviceId: state.backend.deviceId,
      },
      updatedAt: state.updatedAt,
    };

    expect(isCurrentAppStatePayload(incomplete)).toBe(false);
    expect(() => parseCurrentAppStatePayload(incomplete)).toThrow("完整");
  });
});
