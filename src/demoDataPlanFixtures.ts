import type { DailyPlan } from "./types";
import { demoDateKey, demoIsoAt } from "./demoDataBuilders";
import { demoHistoricalCompletedPomodoros } from "./demoDataHistory";

export const createDemoDailyPlans = (now: string, today: string): DailyPlan[] => [
  {
    id: `demo_plan_${today}`,
    date: today,
    capacityPomodoros: 6,
    committedTaskIds: ["demo_task_today_deep", "demo_task_today_sync", "demo_task_today_report"],
    completedPomodoros: 1,
    recommendedCapacityPomodoros: 6,
    suggestedCapacityPomodoros: 5,
    suggestedTaskIds: ["demo_task_pool_calendar", "demo_task_pool_import"],
    overloadAcknowledged: false,
    reflection: "",
    review: { mood: "normal", wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
    createdAt: now,
    updatedAt: now,
  },
  ...Array.from({ length: 18 }, (_, index): DailyPlan => {
    const offset = -(index + 1);
    const completed = demoHistoricalCompletedPomodoros[index];
    return {
      id: `demo_plan_${demoDateKey(offset)}`,
      date: demoDateKey(offset),
      capacityPomodoros: 5 + (index % 3),
      committedTaskIds:
        index % 4 === 0
          ? ["demo_task_done_prd", "demo_task_done_focus", "demo_task_pool_calendar"]
          : ["demo_task_done_nav", "demo_task_done_review", "demo_task_today_sync"],
      completedPomodoros: completed,
      recommendedCapacityPomodoros: 6,
      suggestedCapacityPomodoros: completed >= 5 ? 6 : completed <= 1 ? 4 : 5,
      suggestedTaskIds: ["demo_task_today_deep", "demo_task_pool_import"],
      overloadAcknowledged: false,
      reflection: "演示数据：记录当天计划执行情况。",
      review: {
        mood: completed >= 4 ? "good" : completed <= 1 ? "low" : "normal",
        wins: completed >= 4 ? "上午推进顺利，关键任务有明显进展。" : "至少保住了一轮关键专注。",
        blockers: completed <= 1 ? "临时沟通和消息切换较多。" : "部分任务估算略偏乐观。",
        interruptionPattern: index % 3 === 0 ? "内部想法偏多，需要先写入收件箱。" : "外部消息主要集中在 10:00-11:00。",
        tomorrowFocus: completed <= 1 ? "降低容量，只承诺一个核心任务。" : "先做一个高价值任务，再处理零碎事项。",
      },
      reviewedAt: demoIsoAt(offset, 18),
      createdAt: demoIsoAt(offset, 8),
      updatedAt: demoIsoAt(offset, 18),
    };
  }),
];
