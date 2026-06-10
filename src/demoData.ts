import { createInitialState, todayKey } from "./seed";
import type { AppState, DailyPlan, FocusSession, Interruption, StrictViolation, Task } from "./types";

const isoAt = (offsetDays: number, hour: number, minute = 0) => {
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString();
};

const dateKey = (offsetDays: number) => todayKey(new Date(new Date().setDate(new Date().getDate() + offsetDays)));

const session = (
  id: string,
  taskId: string,
  offsetDays: number,
  hour: number,
  outcome: "completed" | "aborted" = "completed",
  internal = 0,
  external = 0,
): FocusSession => ({
  id,
  taskId,
  mode: "focus",
  duration: 25 * 60,
  startedAt: isoAt(offsetDays, hour),
  endedAt: isoAt(offsetDays, hour, outcome === "completed" ? 25 : 12),
  outcome,
  interruptionCounts: { internal, external },
  strictProfileId: "profile_default",
});

const makeTask = (patch: Partial<Task> & Pick<Task, "id" | "title" | "project" | "estimatePomodoros" | "status">): Task => {
  const now = new Date().toISOString();
  return {
    notes: "",
    tags: [],
    projectId: baseProjectId,
    priority: "medium",
    severity: "medium",
    repeatRule: "none",
    subtasks: [],
    sortOrder: 100,
    actualPomodoros: 0,
    estimateHistory: [],
    createdAt: now,
    updatedAt: now,
    ...patch,
  };
};

const baseProjectId = "project_starter";

export const createDemoState = (): AppState => {
  const base = createInitialState();
  const now = new Date().toISOString();
  const today = dateKey(0);

  const tasks: Task[] = [
    makeTask({
      id: "demo_task_today_deep",
      title: "完成工作台信息精简",
      notes: "目标是让今天只看到承诺任务、快速收集和开始专注，不再被辅助信息淹没。",
      tags: ["产品", "体验"],
      project: "TimeManage",
      priority: "urgent",
      severity: "high",
      estimatePomodoros: 3,
      actualPomodoros: 1,
      status: "in_progress",
      dueAt: isoAt(0, 18),
      subtasks: [
        { id: "demo_sub_1", title: "收起辅助模块", completed: true, createdAt: now, completedAt: now },
        { id: "demo_sub_2", title: "压缩任务卡片", completed: true, createdAt: now, completedAt: now },
        { id: "demo_sub_3", title: "检查移动端布局", completed: false, createdAt: now },
      ],
      sortOrder: 10,
    }),
    makeTask({
      id: "demo_task_today_sync",
      title: "验证本地同步服务",
      notes: "在设置页登录 demo/demo，确认推送、拉取和冲突提示是否能跑通。",
      tags: ["同步", "验收"],
      project: "TimeManage",
      priority: "high",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 0,
      status: "committed",
      reminderAt: isoAt(0, 16),
      sortOrder: 20,
    }),
    makeTask({
      id: "demo_task_today_report",
      title: "看一遍自律报告",
      notes: "重点看完成率、估算偏差、中断热区和容量建议。",
      tags: ["复盘", "报告"],
      project: "个人节奏",
      priority: "medium",
      severity: "medium",
      estimatePomodoros: 1,
      actualPomodoros: 0,
      status: "committed",
      sortOrder: 30,
    }),
    makeTask({
      id: "demo_task_pool_ios",
      title: "拆分 iOS 严格模式接入",
      notes: "任务太大，应该先拆成权限申请、清单选择、专注期屏蔽、恢复监控四步。",
      tags: ["iOS", "严格模式"],
      project: "原生插件",
      priority: "high",
      severity: "very_high",
      estimatePomodoros: 9,
      actualPomodoros: 0,
      status: "pool",
      dueAt: isoAt(2, 18),
      sortOrder: 40,
    }),
    makeTask({
      id: "demo_task_pool_calendar",
      title: "补齐日历月视图空状态",
      tags: ["日历", "UI"],
      project: "TimeManage",
      priority: "medium",
      severity: "low",
      estimatePomodoros: 2,
      actualPomodoros: 0,
      status: "pool",
      sortOrder: 50,
    }),
    makeTask({
      id: "demo_task_pool_import",
      title: "完善数据导入前的备份提示",
      notes: "导入 JSON 前自动创建恢复点，并在结果页展示任务、番茄、计划的增量。",
      tags: ["数据", "备份"],
      project: "数据安全",
      priority: "high",
      severity: "high",
      estimatePomodoros: 3,
      actualPomodoros: 0,
      status: "pool",
      dueAt: isoAt(1, 17),
      sortOrder: 55,
    }),
    makeTask({
      id: "demo_task_pool_shortcuts",
      title: "整理快捷键帮助弹窗",
      notes: "把 Cmd+K、空格、Enter、方向键这些操作放到一个紧凑帮助面板里。",
      tags: ["效率", "键盘"],
      project: "TimeManage",
      priority: "medium",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 0,
      status: "pool",
      sortOrder: 56,
    }),
    makeTask({
      id: "demo_task_pool_mobile",
      title: "检查小屏幕下任务卡片换行",
      tags: ["移动端", "UI"],
      project: "体验优化",
      priority: "medium",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 0,
      status: "pool",
      sortOrder: 57,
    }),
    makeTask({
      id: "demo_task_pool_weekly",
      title: "准备周复盘模板",
      notes: "固定回答：本周兑现率、低估任务、最常见中断、下周容量。",
      tags: ["周复盘", "模板"],
      project: "个人节奏",
      priority: "low",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 0,
      status: "pool",
      repeatRule: "weekly",
      sortOrder: 58,
    }),
    makeTask({
      id: "demo_task_done_prd",
      title: "整理首版 PRD",
      tags: ["产品"],
      project: "TimeManage",
      priority: "high",
      severity: "high",
      estimatePomodoros: 3,
      actualPomodoros: 4,
      status: "completed",
      completedAt: isoAt(-1, 17),
      sortOrder: 60,
    }),
    makeTask({
      id: "demo_task_done_nav",
      title: "把左侧菜单改成应用式导航",
      tags: ["导航", "桌面应用"],
      project: "体验优化",
      priority: "high",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 2,
      status: "completed",
      completedAt: isoAt(-2, 18),
      sortOrder: 70,
    }),
    makeTask({
      id: "demo_task_done_focus",
      title: "完成专注页迷你计时器",
      tags: ["计时器", "专注"],
      project: "TimeManage",
      priority: "high",
      severity: "high",
      estimatePomodoros: 4,
      actualPomodoros: 5,
      status: "completed",
      completedAt: isoAt(-5, 16),
      sortOrder: 80,
    }),
    makeTask({
      id: "demo_task_done_review",
      title: "设计日终回顾字段",
      tags: ["复盘", "方法论"],
      project: "个人节奏",
      priority: "medium",
      severity: "medium",
      estimatePomodoros: 2,
      actualPomodoros: 2,
      status: "completed",
      completedAt: isoAt(-8, 18),
      sortOrder: 90,
    }),
  ];

  const historicalTaskIds = [
    "demo_task_done_prd",
    "demo_task_done_nav",
    "demo_task_done_focus",
    "demo_task_done_review",
    "demo_task_pool_calendar",
    "demo_task_today_sync",
  ];
  const generatedSessions = Array.from({ length: 18 }, (_, dayIndex) => {
    const offset = -(dayIndex + 1);
    const completedCount = [4, 3, 5, 2, 4, 1, 0, 5, 3, 2, 4, 3, 1, 4, 2, 5, 3, 2][dayIndex];
    const sessionsForDay = Array.from({ length: completedCount }, (_, sessionIndex) =>
      session(
        `demo_s_hist_${dayIndex}_${sessionIndex}`,
        historicalTaskIds[(dayIndex + sessionIndex) % historicalTaskIds.length],
        offset,
        9 + sessionIndex + (sessionIndex > 2 ? 1 : 0),
        "completed",
        sessionIndex === 1 && dayIndex % 3 === 0 ? 1 : 0,
        sessionIndex === 2 && dayIndex % 4 === 0 ? 1 : 0,
      ),
    );
    if (dayIndex % 5 === 1) {
      sessionsForDay.push(
        session(`demo_s_hist_abort_${dayIndex}`, historicalTaskIds[dayIndex % historicalTaskIds.length], offset, 15, "aborted", 1, 1),
      );
    }
    return sessionsForDay;
  }).flat();

  const focusSessions: FocusSession[] = [
    session("demo_s_today_1", "demo_task_today_deep", 0, 9, "completed", 1, 0),
    session("demo_s_y_1", "demo_task_done_prd", -1, 9),
    session("demo_s_y_2", "demo_task_done_prd", -1, 10, "completed", 0, 1),
    session("demo_s_y_3", "demo_task_done_prd", -1, 14),
    session("demo_s_y_4", "demo_task_done_prd", -1, 15),
    session("demo_s_2_1", "demo_task_pool_calendar", -2, 10),
    session("demo_s_2_2", "demo_task_pool_calendar", -2, 11, "aborted", 2, 1),
    session("demo_s_3_1", "demo_task_today_sync", -3, 9),
    session("demo_s_4_1", "demo_task_today_report", -4, 16),
    session("demo_s_5_1", "demo_task_today_deep", -5, 10, "completed", 1, 0),
    session("demo_s_6_1", "demo_task_done_prd", -6, 15),
    ...generatedSessions,
  ];

  const historicalCompleted = [4, 3, 5, 2, 4, 1, 0, 5, 3, 2, 4, 3, 1, 4, 2, 5, 3, 2];
  const dailyPlans: DailyPlan[] = [
    {
      id: `demo_plan_${today}`,
      date: today,
      capacityPomodoros: 6,
      committedTaskIds: ["demo_task_today_deep", "demo_task_today_sync", "demo_task_today_report"],
      completedPomodoros: 1,
      recommendedCapacityPomodoros: 6,
      suggestedCapacityPomodoros: 5,
      suggestedTaskIds: ["demo_task_pool_ios", "demo_task_pool_calendar"],
      overloadAcknowledged: false,
      reflection: "",
      review: { mood: "normal", wins: "", blockers: "", interruptionPattern: "", tomorrowFocus: "" },
      createdAt: now,
      updatedAt: now,
    },
    ...Array.from({ length: 18 }, (_, index): DailyPlan => {
      const offset = -(index + 1);
      const completed = historicalCompleted[index];
      return {
      id: `demo_plan_${dateKey(offset)}`,
      date: dateKey(offset),
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
      reviewedAt: isoAt(offset, 18),
      createdAt: isoAt(offset, 8),
      updatedAt: isoAt(offset, 18),
      };
    }),
  ];

  const interruptions: Interruption[] = [
    {
      id: "demo_int_1",
      sessionId: "demo_s_today_1",
      taskId: "demo_task_today_deep",
      type: "internal",
      note: "突然想查导航栏设计参考",
      action: "defer",
      createdAt: isoAt(0, 9, 12),
      resolvedAt: isoAt(0, 9, 30),
    },
    {
      id: "demo_int_2",
      taskId: "demo_task_today_sync",
      type: "external",
      note: "同事发来一个临时确认项",
      action: "inbox",
      createdAt: isoAt(0, 11, 5),
    },
    {
      id: "demo_int_3",
      sessionId: "demo_s_2_2",
      taskId: "demo_task_pool_calendar",
      type: "external",
      note: "群消息导致番茄作废",
      action: "abort",
      createdAt: isoAt(-2, 11, 8),
      resolvedAt: isoAt(-2, 11, 30),
    },
    ...Array.from({ length: 12 }, (_, index): Interruption => {
      const offset = -(index + 1);
      const external = index % 2 === 0;
      return {
        id: `demo_int_hist_${index}`,
        sessionId: `demo_s_hist_${index}_1`,
        taskId: historicalTaskIds[index % historicalTaskIds.length],
        type: external ? "external" : "internal",
        note: external ? "消息通知打断，记录后推迟处理" : "想到另一个改动点，先记入收件箱",
        action: index % 4 === 0 ? "inbox" : "defer",
        createdAt: isoAt(offset, 10 + (index % 4), 8),
        resolvedAt: index % 4 === 0 ? undefined : isoAt(offset, 17, 30),
      };
    }),
  ];

  const strictViolations: StrictViolation[] = [
    {
      id: "demo_strict_1",
      sessionId: "demo_s_2_2",
      taskId: "demo_task_pool_calendar",
      profileId: "profile_default",
      appName: "Bilibili",
      matchedType: "app",
      matchedValue: "Bilibili",
      action: "recorded",
      createdAt: isoAt(-2, 11, 7),
    },
    {
      id: "demo_strict_2",
      sessionId: "demo_s_hist_abort_6",
      taskId: "demo_task_done_focus",
      profileId: "profile_default",
      url: "youtube.com",
      matchedType: "website",
      matchedValue: "youtube.com",
      action: "paused",
      createdAt: isoAt(-7, 15, 9),
    },
    {
      id: "demo_strict_3",
      sessionId: "demo_s_hist_abort_11",
      taskId: "demo_task_done_review",
      profileId: "profile_default",
      appName: "微信视频号",
      matchedType: "app",
      matchedValue: "微信视频号",
      action: "aborted",
      createdAt: isoAt(-12, 15, 11),
    },
  ];

  return {
    ...base,
    onboarding: {
      ...base.onboarding,
      completed: true,
      desiredHabit: "每天先完成 1 个最重要任务，再处理沟通和零碎事项",
      dailyGoalPomodoros: 5,
    },
    tasks,
    dailyPlans,
    focusSessions,
    workSessions: [],
    executionSignals: [],
    interruptions,
    strictViolations,
    rewardState: {
      streak: 11,
      dailyGoal: 5,
      badges: ["首个承诺", "连续 3 天", "连续 7 天", "严格模式就绪", "复盘入门", "估算校准"],
      focusGarden: 56,
      visualProgress: 84,
      lastRewardedAt: now,
    },
    updatedAt: now,
  };
};
