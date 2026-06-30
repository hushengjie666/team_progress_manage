import type { AppState, BlockProfile, NativeCapabilityState, Project, ProjectMember, TaskTemplate, TeamMember } from "./types";

export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const uid = (prefix: string) => {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
};

const now = () => new Date().toISOString();

export const defaultSyncServerUrl = () => {
  if (typeof window === "undefined") return "http://127.0.0.1:8787";
  const { protocol, hostname, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    const isLocalHost = hostname === "127.0.0.1" || hostname === "localhost" || hostname === "::1";
    if (!isLocalHost) return origin;
  }
  return "http://127.0.0.1:8787";
};

export const starterProject: Project = {
  id: "project_starter",
  name: "TimeManage 团队进度",
  description: "从个人时间管理迁移而来的团队进度管控起始项目。",
  defaultExpectedStartHours: 24,
  createdAt: now(),
  updatedAt: now(),
};

export const starterProjectMember: ProjectMember = {
  id: "member_owner",
  projectId: starterProject.id,
  teamMemberId: "team_member_owner",
  accountId: "account_owner",
  name: "项目负责人",
  email: "owner@example.com",
  roles: ["project_owner", "executor"],
  status: "active",
  createdAt: now(),
  updatedAt: now(),
};

export const starterTeamMember: TeamMember = {
  id: "team_member_owner",
  accountId: "account_owner",
  name: "项目负责人",
  email: "owner@example.com",
  status: "active",
  createdAt: now(),
  updatedAt: now(),
};

const defaultProfile: BlockProfile = {
  id: "profile_default",
  name: "深度专注",
  apps: ["抖音", "Bilibili", "小红书", "微信视频号"],
  websites: ["douyin.com", "bilibili.com", "weibo.com", "youtube.com"],
  schedule: "专注番茄期间",
  strictness: "locked",
  platformPermissionState: "unknown",
  createdAt: now(),
  updatedAt: now(),
};

export const defaultTaskTemplates: TaskTemplate[] = [
  {
    id: "template_morning_plan",
    name: "晨间计划",
    description: "启动当天承诺、检查提醒、留出缓冲。",
    project: "个人节奏",
    tags: ["计划", "晨间"],
    priority: "high",
    severity: "medium",
    estimatePomodoros: 1,
    subtasks: ["查看昨日回顾", "选择今日 1-3 个承诺", "开启第一颗番茄"],
    repeatRule: "daily",
  },
  {
    id: "template_weekly_review",
    name: "周复盘",
    description: "回顾完成率、估算偏差和下周容量。",
    project: "复盘",
    tags: ["周复盘", "报告"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 2,
    subtasks: ["检查承诺兑现率", "记录低估任务类型", "调整下周屏蔽清单"],
    repeatRule: "weekly",
  },
  {
    id: "template_deep_dev",
    name: "开发专注",
    description: "用于需要连续推进的开发任务。",
    project: "开发",
    tags: ["开发", "深度工作"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 4,
    subtasks: ["明确验收点", "实现最小闭环", "运行测试", "记录遗留问题"],
  },
  {
    id: "template_learning",
    name: "学习计划",
    description: "读资料、做笔记、输出练习。",
    project: "学习",
    tags: ["学习", "输入"],
    priority: "medium",
    severity: "medium",
    estimatePomodoros: 3,
    subtasks: ["阅读资料", "整理笔记", "做一次输出练习"],
  },
];

export const defaultNativeCapabilities: NativeCapabilityState[] = [
  {
    platform: "browser",
    label: "浏览器预览",
    available: true,
    permissionState: "unavailable",
    capabilities: ["本地数据", "Web 通知 fallback", "软严格模式说明", "命令面板"],
    fallback: "无法读取前台 App/URL，也不会进行系统级拦截。",
  },
  {
    platform: "tauri_macos",
    label: "Tauri macOS",
    available: true,
    permissionState: "unknown",
    capabilities: ["本地文件保存", "本地通知", "前台 App/URL 软检测", "置顶迷你计时器", "全局快捷键适配层"],
    fallback: "权限不足时降级为浏览器同等软记录，不承诺硬拦截。",
  },
  {
    platform: "ios",
    label: "iOS Screen Time 适配层",
    available: false,
    permissionState: "unknown",
    capabilities: ["FamilyControls 选择清单", "ManagedSettings 专注期屏蔽", "DeviceActivity 恢复监控"],
    fallback: "当前桌面内测只保留数据结构与能力说明，真实 iOS 屏蔽需要移动端构建验收。",
  },
];

export const createInitialState = (): AppState => ({
  version: 1,
  onboarding: {
    completed: true,
    distractionSources: ["短视频", "社交消息", "资讯流"],
    desiredHabit: "每天完成 8 个高质量番茄",
    currentDailyWasteMinutes: 120,
    dailyGoalPomodoros: 8,
    preferredFocusMinutes: 25,
    strictModeIntent: "locked",
    syncIntent: "local",
  },
  settings: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    strictModeEnabled: true,
    notificationsEnabled: true,
    soundEnabled: true,
    activeBlockProfileId: "profile_default",
    whiteNoise: "off",
    whiteNoiseVolume: 35,
    timerEndSound: "soft",
    notificationSettings: {
      permissionState: "unknown",
    },
    dismissedCoachSteps: [],
    advancedSyncVisible: false,
    reportFilter: {
      range: "30d",
      project: "all",
      tag: "all",
      taskId: "all",
    },
    calendarViewMode: "week",
    commandPaletteHintDismissed: false,
  },
  auth: {
    status: "signed_out",
    bootstrapped: undefined,
    message: "请登录团队工作区",
  },
  currentMemberId: starterProjectMember.id,
  projects: [starterProject],
  teamMembers: [starterTeamMember],
  projectMembers: [starterProjectMember],
  tasks: [],
  dailyPlans: [],
  focusSessions: [],
  workSessions: [],
  executionSignals: [],
  interruptions: [],
  strictViolations: [],
  blockProfiles: [defaultProfile],
  rewardState: {
    streak: 0,
    dailyGoal: 8,
    badges: ["首个承诺", "严格模式就绪"],
    focusGarden: 0,
    visualProgress: 0,
  },
  sync: {
    enabled: false,
    serverUrl: defaultSyncServerUrl(),
    username: "demo",
    deviceId: uid("device"),
    autoSync: true,
    intervalSeconds: 60,
    retryCount: 0,
    lastPulledRevision: 0,
    status: "idle",
    message: "本地同步服务未连接",
    conflictCount: 0,
    tombstones: [],
    conflicts: [],
  },
  backupSnapshots: [],
  taskTemplates: defaultTaskTemplates,
  templateInstances: [],
  nativeCapabilities: defaultNativeCapabilities,
  updatedAt: now(),
});
