import type { Interruption } from "./types";
import { demoIsoAt } from "./demoDataBuilders";
import { demoHistoricalTaskIds } from "./demoDataHistory";

export const createDemoInterruptions = (): Interruption[] => [
  {
    id: "demo_int_1",
    sessionId: "demo_s_today_1",
    taskId: "demo_task_today_deep",
    type: "internal",
    note: "突然想查导航栏设计参考",
    action: "defer",
    createdAt: demoIsoAt(0, 9, 12),
    resolvedAt: demoIsoAt(0, 9, 30),
  },
  {
    id: "demo_int_2",
    taskId: "demo_task_today_sync",
    type: "external",
    note: "同事发来一个临时确认项",
    action: "inbox",
    createdAt: demoIsoAt(0, 11, 5),
  },
  {
    id: "demo_int_3",
    sessionId: "demo_s_2_2",
    taskId: "demo_task_pool_calendar",
    type: "external",
    note: "群消息导致番茄作废",
    action: "abort",
    createdAt: demoIsoAt(-2, 11, 8),
    resolvedAt: demoIsoAt(-2, 11, 30),
  },
  ...Array.from({ length: 12 }, (_, index): Interruption => {
    const offset = -(index + 1);
    const external = index % 2 === 0;
    return {
      id: `demo_int_hist_${index}`,
      sessionId: `demo_s_hist_${index}_1`,
      taskId: demoHistoricalTaskIds[index % demoHistoricalTaskIds.length],
      type: external ? "external" : "internal",
      note: external ? "消息通知打断，记录后推迟处理" : "想到另一个改动点，先记入收件箱",
      action: index % 4 === 0 ? "inbox" : "defer",
      createdAt: demoIsoAt(offset, 10 + (index % 4), 8),
      resolvedAt: index % 4 === 0 ? undefined : demoIsoAt(offset, 17, 30),
    };
  }),
];
