import { describe, expect, it } from "vitest";
import { stageTaskCardClassName, stageTaskSortRank, stageTaskStatePills, stageTaskStatusLabel } from "../projectTaskDisplay";

describe("stageTaskStatusLabel", () => {
  it("labels in-progress lifecycle as started", () => {
    expect(stageTaskStatusLabel("in_progress")).toBe("已开始");
  });

  it("keeps pooled tasks explicit", () => {
    expect(stageTaskStatusLabel("pool")).toBe("任务池");
  });

  it("keeps review status explicit", () => {
    expect(stageTaskStatusLabel("pending_review")).toBe("待验收");
  });
});

describe("stageTaskStatePills", () => {
  it("does not add a redundant started pill", () => {
    expect(stageTaskStatePills("in_progress", false)).toEqual([]);
  });

  it("uses running only for active work sessions", () => {
    expect(stageTaskStatePills("in_progress", true)).toEqual([{ className: "running", label: "执行中" }]);
  });

  it("shows review exactly once", () => {
    expect(stageTaskStatePills("pending_review", false)).toEqual([{ className: "review", label: "待验收" }]);
  });

  it("does not show running and review at the same time", () => {
    expect(stageTaskStatePills("pending_review", true)).toEqual([{ className: "review", label: "待验收" }]);
  });

  it("does not show running for completed tasks", () => {
    expect(stageTaskStatePills("completed", true)).toEqual([]);
  });
});

describe("stageTaskCardClassName", () => {
  it("keeps ordinary tasks visually neutral", () => {
    expect(stageTaskCardClassName("pool", false, false)).toBe("project-stage-task-card");
    expect(stageTaskCardClassName("completed", false, false)).toBe("project-stage-task-card");
  });

  it("uses only one emphasis class by priority", () => {
    expect(stageTaskCardClassName("pending_review", true, true)).toBe("project-stage-task-card review");
    expect(stageTaskCardClassName("completed", true, true)).toBe("project-stage-task-card today");
    expect(stageTaskCardClassName("pending_review", false, true)).toBe("project-stage-task-card review");
    expect(stageTaskCardClassName("committed", false, true)).toBe("project-stage-task-card today");
    expect(stageTaskCardClassName("pending_review", false, false)).toBe("project-stage-task-card review");
  });
});

describe("stageTaskSortRank", () => {
  it("puts pending review tasks before every other visual priority", () => {
    expect(stageTaskSortRank("pending_review", false, false)).toBeLessThan(stageTaskSortRank("in_progress", true, false));
    expect(stageTaskSortRank("pending_review", false, false)).toBeLessThan(stageTaskSortRank("committed", false, true));
  });

  it("keeps active tasks before today tasks after review tasks", () => {
    expect(stageTaskSortRank("in_progress", true, false)).toBeLessThan(stageTaskSortRank("committed", false, true));
    expect(stageTaskSortRank("completed", true, true)).toBe(stageTaskSortRank("completed", false, true));
    expect(stageTaskSortRank("committed", false, true)).toBeLessThan(stageTaskSortRank("pool", false, false));
  });
});
