import { describe, expect, it } from "vitest";
import { instantiateTemplate, parseQuickInput } from "./planning";
import type { TaskTemplate } from "./types";

describe("planning utilities", () => {
  it("builds template tasks", () => {
    const template: TaskTemplate = {
      id: "template_test",
      name: "测试模板",
      description: "模板说明",
      project: "测试",
      tags: ["模板"],
      priority: "high",
      severity: "medium",
      estimatePomodoros: 2,
      subtasks: ["第一步", "第二步"],
    };
    const task = instantiateTemplate(template, "2026-05-10T10:00:00.000Z");
    expect(task.subtasks).toHaveLength(2);
    expect(task.project).toBe("测试");
  });

  it("parses natural language quick input", () => {
    const parsed = parseQuickInput("明天10点 写周报 #工作 @运营 2p !!", new Date("2026-05-10T08:00:00+08:00"));
    expect(parsed.title).toBe("写周报");
    expect(parsed.tags).toEqual(["工作"]);
    expect(parsed.project).toBe("运营");
    expect(parsed.priority).toBe("high");
    expect(parsed.estimatePomodoros).toBe(2);
    expect(parsed.dueAt).toBeTruthy();
  });
});
