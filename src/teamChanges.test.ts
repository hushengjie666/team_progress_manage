import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { businessChangesBetween } from "./teamBusinessRows";

const iso = (value: string) => new Date(value).toISOString();

describe("team business changes", () => {
  it("sends a project-member delete row when a project member is removed", () => {
    const base = createInitialState();
    const timestamp = iso("2026-06-30T07:00:00Z");
    const deleted = {
      ...base,
      projectMembers: [],
      updatedAt: timestamp,
    };

    const changes = businessChangesBetween(base, deleted);

    expect(changes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          entity: "project_member",
          id: base.projectMembers[0].id,
          deleted_at: timestamp,
          payload: {},
        }),
      ]),
    );
  });
});
