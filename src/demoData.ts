import { createInitialState, todayKey } from "./seed";
import { resolveMemberIdForProject, sameMemberIdentity } from "./memberIdentity";
import type { AppState, DailyPlan, FocusSession, Interruption, ProjectMember, StrictViolation, Task, TaskStage, TaskStageMode } from "./types";

const demoProjectIdSuffix = (projectId: string) => projectId.replace(/[^a-zA-Z0-9_-]/g, "_");

export const demoTaskIdForProject = (taskId: string, projectId: string) => `${taskId}_${demoProjectIdSuffix(projectId)}`;

const demoEntityIdForProject = (id: string, projectId: string) => `${id}_${demoProjectIdSuffix(projectId)}`;

const upsertById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
};

const appendUnique = (current: string[], incoming: string[]) => [...current, ...incoming.filter((id) => !current.includes(id))];

const mapDemoTaskId = (taskId: string | undefined, projectId: string) => (taskId ? demoTaskIdForProject(taskId, projectId) : undefined);

const mapDemoSessionId = (sessionId: string | undefined, projectId: string) =>
  sessionId ? demoEntityIdForProject(sessionId, projectId) : undefined;

const keepsTimeManageDemoLanguage = (projectName: string) => /timemanage/i.test(projectName) || projectName.includes("时间管理");

const softwareToRegularStage: Record<TaskStage, TaskStage> = {
  planning: "planning",
  execution: "execution",
  check: "check",
  sales: "planning",
  requirements: "planning",
  design: "planning",
  development: "execution",
  testing: "check",
  deployment: "execution",
  acceptance: "check",
};

const regularToSoftwareStage: Record<TaskStage, TaskStage> = {
  planning: "requirements",
  execution: "development",
  check: "testing",
  sales: "sales",
  requirements: "requirements",
  design: "design",
  development: "development",
  testing: "testing",
  deployment: "deployment",
  acceptance: "acceptance",
};

const normalizeDemoTaskStage = (stage: TaskStage, mode: TaskStageMode): TaskStage =>
  mode === "regular" ? softwareToRegularStage[stage] : regularToSoftwareStage[stage];

const fallbackDemoTaskNotes = (task: Task, projectName: string) =>
  `围绕${projectName}推进「${task.title}」，补齐背景、执行口径和验收要点，确保演示数据可以直接用于功能体验。`;

const fallbackDemoTaskProgressNote = (task: Task) => {
  if (task.status === "completed") return "演示任务已完成，用于展示历史完成记录和复盘效果。";
  if (task.status === "in_progress") return "演示任务正在推进中，用于展示当前工作状态和进度变化。";
  if (task.status === "committed") return "演示任务已进入今日队列，用于展示待执行任务。";
  if (task.status === "pending_review") return "演示任务等待负责人验收。";
  return "演示任务已进入任务池，可用于安排和分配。";
};

const targetProjectDemoTaskPatch = (task: Task, projectName: string): Partial<Task> => {
  if (keepsTimeManageDemoLanguage(projectName)) return {};

  const projectLabel = projectName.replace(/系统|项目/g, "").trim() || projectName;
  const patches: Record<string, Partial<Task>> = {
    demo_task_today_deep: {
      title: `完成${projectLabel}样例集核验`,
      notes: `核对${projectName}的核心样例、异常样例和验收口径，确保今天能看到真实项目进展。`,
      tags: ["验收", "样例"],
      stage: "testing",
    },
    demo_task_today_sync: {
      title: `验证${projectLabel}团队数据流转`,
      notes: `确认${projectName}的任务分配、进度更新和成员协作记录能正常保存并刷新。`,
      tags: ["协作", "验收"],
      stage: "testing",
    },
    demo_task_today_report: {
      title: `整理${projectLabel}验收报告`,
      notes: `汇总今日测试结论、风险点和下一步处理项，方便团队对齐项目状态。`,
      tags: ["报告", "复盘"],
      stage: "acceptance",
    },
    demo_task_pool_ios: {
      title: `拆分${projectLabel}部署任务`,
      notes: `把部署准备拆成环境检查、数据准备、接口联调和验收回归四步。`,
      tags: ["部署", "拆分"],
      stage: "deployment",
    },
    demo_task_pool_calendar: {
      title: `补齐${projectLabel}空状态检查`,
      notes: `检查无数据、加载失败和部分结果缺失时的提示是否清晰。`,
      tags: ["体验", "测试"],
      stage: "testing",
    },
    demo_task_pool_import: {
      title: `准备${projectLabel}导入前备份`,
      notes: `导入新样例或配置前创建恢复点，并记录新增数据的影响范围。`,
      tags: ["数据", "备份"],
      stage: "requirements",
    },
    demo_task_pool_shortcuts: {
      title: `整理${projectLabel}常用操作清单`,
      notes: `把测试、验收、回退和问题记录的常用动作整理成可执行清单。`,
      tags: ["效率", "流程"],
      stage: "requirements",
    },
    demo_task_pool_mobile: {
      title: `检查${projectLabel}小屏展示`,
      notes: `确认移动端下任务卡片、结果摘要和风险提示不会遮挡或溢出。`,
      tags: ["移动端", "UI"],
      stage: "testing",
    },
    demo_task_pool_weekly: {
      title: `准备${projectLabel}周复盘模板`,
      notes: `固定回顾本周验收结论、遗留问题、风险变化和下周计划。`,
      tags: ["周复盘", "模板"],
      stage: "acceptance",
    },
    demo_task_done_prd: {
      title: `整理${projectLabel}首版需求`,
      tags: ["需求"],
      stage: "requirements",
    },
    demo_task_done_nav: {
      title: `完成${projectLabel}流程梳理`,
      tags: ["流程", "协作"],
      stage: "design",
    },
    demo_task_done_focus: {
      title: `完成${projectLabel}核心用例验证`,
      tags: ["验证", "核心流程"],
      stage: "testing",
    },
    demo_task_done_review: {
      title: `设计${projectLabel}回顾字段`,
      tags: ["复盘", "验收"],
      stage: "acceptance",
    },
  };

  return patches[task.id] ?? {};
};

const preferredDemoExecutorForProject = (state: AppState, projectId: string, preferredMemberId?: string): ProjectMember | undefined => {
  const projectExecutors = state.projectMembers.filter(
    (member) => member.projectId === projectId && member.status !== "disabled" && member.roles.includes("executor"),
  );
  const preferredMember = preferredMemberId
    ? state.projectMembers.find((member) => member.id === preferredMemberId && member.status !== "disabled")
    : undefined;
  const accountId = state.auth.account?.id;
  return (
    projectExecutors.find((member) => preferredMember && member.id === preferredMember.id) ??
    projectExecutors.find((member) => preferredMember && sameMemberIdentity(member, preferredMember)) ??
    projectExecutors.find((member) => accountId && member.accountId === accountId) ??
    projectExecutors[0]
  );
};

export const mergeDemoDataIntoState = (current: AppState, targetProjectId?: string, timestamp = new Date().toISOString()): AppState => {
  const targetProject = current.projects.find((project) => project.id === targetProjectId) ?? current.projects[0];
  if (!targetProject) return current;

  const demo = createDemoState();
  const projectId = targetProject.id;
  const workspaceId = targetProject.workspaceId ?? current.auth.workspace?.id;
  const taskStageMode = targetProject.taskStageMode ?? "software";
  const mapTaskId = (taskId: string) => demoTaskIdForProject(taskId, projectId);
  const mapEntityId = (id: string) => demoEntityIdForProject(id, projectId);
  const actorMemberId = resolveMemberIdForProject(current, projectId);
  const targetExecutor = preferredDemoExecutorForProject(current, projectId, actorMemberId);
  const targetExecutorMemberId = targetExecutor?.id ?? actorMemberId;

  const tasks = demo.tasks.map((task) => {
    const taskPatch = targetProjectDemoTaskPatch(task, targetProject.name);
    const patchedTask = { ...task, ...taskPatch };
    return {
      ...patchedTask,
      id: mapTaskId(task.id),
      workspaceId,
      projectId,
      project: targetProject.name,
      creatorMemberId: actorMemberId ?? targetExecutorMemberId,
      primaryExecutorMemberId: targetExecutorMemberId,
      collaboratorMemberIds: [],
      notes: patchedTask.notes.trim() || fallbackDemoTaskNotes(patchedTask, targetProject.name),
      tags: patchedTask.tags.length ? patchedTask.tags : ["演示", "任务"],
      stage: normalizeDemoTaskStage(patchedTask.stage, taskStageMode),
      progressNote: (patchedTask.progressNote ?? "").trim() || fallbackDemoTaskProgressNote(patchedTask),
      subtasks: task.subtasks.map((subtask) => ({ ...subtask, id: mapEntityId(subtask.id) })),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  });

  const focusSessions = demo.focusSessions.map((session) => ({
    ...session,
    id: mapEntityId(session.id),
    workspaceId,
    taskId: mapDemoTaskId(session.taskId, projectId),
  }));
  const interruptions = demo.interruptions.map((interruption) => ({
    ...interruption,
    id: mapEntityId(interruption.id),
    workspaceId,
    sessionId: mapDemoSessionId(interruption.sessionId, projectId),
    taskId: mapDemoTaskId(interruption.taskId, projectId),
    convertedTaskId: mapDemoTaskId(interruption.convertedTaskId, projectId),
  }));
  const strictViolations = demo.strictViolations.map((violation) => ({
    ...violation,
    id: mapEntityId(violation.id),
    workspaceId,
    sessionId: mapDemoSessionId(violation.sessionId, projectId),
    taskId: mapDemoTaskId(violation.taskId, projectId),
  }));
  const demoPlans = demo.dailyPlans.map((plan) => ({
    ...plan,
    id: mapEntityId(plan.id),
    workspaceId,
    committedTaskIds: plan.committedTaskIds.map(mapTaskId),
    suggestedTaskIds: plan.suggestedTaskIds.map(mapTaskId),
    createdAt: timestamp,
    updatedAt: timestamp,
  }));
  const plansByDate = new Map(current.dailyPlans.map((plan) => [plan.date, plan]));
  const dailyPlans = [
    ...current.dailyPlans.map((plan) => {
      const demoPlan = demoPlans.find((item) => item.date === plan.date);
      if (!demoPlan) return plan;
      return {
        ...plan,
        committedTaskIds: appendUnique(plan.committedTaskIds, demoPlan.committedTaskIds),
        suggestedTaskIds: appendUnique(plan.suggestedTaskIds, demoPlan.suggestedTaskIds),
        updatedAt: timestamp,
      };
    }),
    ...demoPlans.filter((plan) => !plansByDate.has(plan.date)),
  ].sort((left, right) => right.date.localeCompare(left.date));

  return {
    ...current,
    onboarding: {
      ...current.onboarding,
      completed: true,
    },
    tasks: upsertById(current.tasks, tasks),
    dailyPlans,
    focusSessions: upsertById(current.focusSessions, focusSessions),
    interruptions: upsertById(current.interruptions, interruptions),
    strictViolations: upsertById(current.strictViolations, strictViolations),
    rewardState: {
      ...current.rewardState,
      badges: appendUnique(current.rewardState.badges, demo.rewardState.badges),
    },
    updatedAt: timestamp,
  };
};

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
    progressPercent: 0,
    progressNote: "",
    priority: "medium",
    severity: "medium",
    stage: "requirements",
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
      title: "验证本地团队后台",
      notes: "在设置页输入团队后台账号密码，确认推送、拉取和冲突提示是否能跑通。",
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
