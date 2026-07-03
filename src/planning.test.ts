import { describe, expect, it } from "vitest";
import { getTodayPlan } from "./appModel";
import { calendarSummaries, filteredStateForReport, instantiateTemplate, parseQuickInput, reviewSummary } from "./planning";
import { createInitialState } from "./test/fixtures";
import type { TaskTemplate } from "./types";

describe("planning utilities", () => {
  it("builds calendar summaries and template tasks", () => {
    const state = createInitialState();
    const todayPlan = { ...getTodayPlan(state), committedTaskIds: ["task_calendar_test"] };
    const summaries = calendarSummaries({ ...state, dailyPlans: [todayPlan] }, todayPlan.date, 7);
    expect(summaries).toHaveLength(7);
    expect(summaries[0].committedTaskIds.length).toBeGreaterThan(0);
    expect(summaries[0].review).toBeTruthy();
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

  it("parses natural language quick input and filters reports", () => {
    const parsed = parseQuickInput("明天10点 写周报 #工作 @运营 2p !!", new Date("2026-05-10T08:00:00+08:00"));
    expect(parsed.title).toBe("写周报");
    expect(parsed.tags).toEqual(["工作"]);
    expect(parsed.project).toBe("运营");
    expect(parsed.priority).toBe("high");
    expect(parsed.estimatePomodoros).toBe(2);
    expect(parsed.dueAt).toBeTruthy();

    const state = createInitialState();
    const filter = { range: "30d" as const, project: "TimeManage", tag: "all", taskId: "all" };
    expect(filteredStateForReport(state, filter).tasks.every((task) => task.project === "TimeManage")).toBe(true);
    expect(reviewSummary(state, filter).rangeLabel).toBe("近 30 天");
  });
});
