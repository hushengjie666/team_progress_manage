import { describe, expect, it } from "vitest";
import { createInitialState } from "./seed";
import { teamChangesBetween } from "./teamApi";

const iso = (value: string) => new Date(value).toISOString();

describe("team backend changes", () => {
  it("sends a project-member tombstone when a project member is removed", () => {
    const base = createInitialState();
    const timestamp = iso("2026-06-30T07:00:00Z");
    const deleted = {
      ...base,
      projectMembers: [],
      sync: {
        ...base.sync,
        tombstones: [
          ...base.sync.tombstones,
          { entity: "project_member", id: base.projectMembers[0].id, deletedAt: timestamp },
        ],
      },
      updatedAt: timestamp,
    };

    const changes = teamChangesBetween(base, deleted);

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
