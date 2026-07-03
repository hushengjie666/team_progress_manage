import { describe, expect, it } from "vitest";
import type { MyProjectTaskCard } from "../../projectOverview";
import {
  moveProjectIdNearTarget,
  orderMyProjectTaskCards,
  sanitizeMyProjectCardOrder,
  visibleMyProjectTaskCards,
} from "./myProjectTaskCardReorderModel";

const card = (projectId: string): MyProjectTaskCard => ({
  projectId,
  name: projectId,
  workspaceName: "工作区",
  progressPercent: 0,
  myTaskCount: 0,
  poolCount: 0,
  committedCount: 0,
  inProgressCount: 0,
  pendingReviewCount: 0,
});

describe("my project task card reorder model", () => {
  it("moves a project id next to the hovered target based on drag direction", () => {
    expect(moveProjectIdNearTarget(["a", "b", "c", "d"], "a", "c")).toEqual(["b", "c", "a", "d"]);
    expect(moveProjectIdNearTarget(["a", "b", "c", "d"], "d", "b")).toEqual(["a", "d", "b", "c"]);
  });

  it("keeps the original order reference when ids are missing or unchanged", () => {
    const order = ["a", "b", "c"];

    expect(moveProjectIdNearTarget(order, "missing", "b")).toBe(order);
    expect(moveProjectIdNearTarget(order, "a", "missing")).toBe(order);
    expect(moveProjectIdNearTarget(order, "b", "b")).toBe(order);
  });

  it("sanitizes stored order before applying it to cards", () => {
    expect(sanitizeMyProjectCardOrder(["b", "", "a", "b", 1, "c"])).toEqual(["b", "a", "c"]);

    const cards = [card("a"), card("b"), card("c")];
    expect(orderMyProjectTaskCards(cards, ["c", "missing", "a"]).map((item) => item.projectId)).toEqual(["c", "a", "b"]);
  });

  it("uses transient reorder state for visible cards while preserving sorted fallback", () => {
    const cards = [card("a"), card("b"), card("c")];
    const sortedCards = orderMyProjectTaskCards(cards, ["c"]);

    expect(visibleMyProjectTaskCards(cards, sortedCards, null).map((item) => item.projectId)).toEqual(["c", "a", "b"]);
    expect(visibleMyProjectTaskCards(cards, sortedCards, { draggingProjectId: "b", order: ["b", "c"] }).map((item) => item.projectId)).toEqual(["b", "c"]);
  });
});
