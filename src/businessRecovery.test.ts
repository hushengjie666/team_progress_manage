import { describe, expect, it } from "vitest";
import { incompleteRecoveryCount, isIncompleteRecoveredRecord } from "./businessRecovery";
import { createInitialState } from "./test/fixtures";

const recovery = { source: "navicat_missing_payload", originalPayloadAvailable: false };

describe("historical data recovery notice", () => {
  it("counts missing project, task and session details alongside fully restored records", () => {
    const state = createInitialState();
    state.projects[0] = { ...state.projects[0], ...{ recovery } };
    state.tasks[0] = { ...state.tasks[0], ...{ recovery } };
    state.focusSessions = [{
      id: "recovered_focus", mode: "focus", duration: 0, startedAt: "2026-10-09T00:00:00Z",
      interruptionCounts: { internal: 0, external: 0 }, ...{ recovery },
    }];
    expect(incompleteRecoveryCount(state)).toBe(3);
  });

  it("does not label ordinary data, malformed metadata or complete snapshots as missing", () => {
    expect(incompleteRecoveryCount(createInitialState())).toBe(0);
    for (const record of [null, {}, { recovery: null }, { recovery: false },
      { recovery: { source: "another_source", originalPayloadAvailable: false } },
      { recovery: { source: "navicat_missing_payload", originalPayloadAvailable: true } }]) {
      expect(isIncompleteRecoveredRecord(record)).toBe(false);
    }
  });
});
