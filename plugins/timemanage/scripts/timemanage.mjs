#!/usr/bin/env node

// mcp-server/src/config.ts
import { existsSync, readFileSync } from "node:fs";
import { homedir, hostname, platform } from "node:os";
import { join, resolve } from "node:path";
var defaultConfigPath = () => {
  if (platform() === "win32") {
    const appData = process.env.APPDATA || join(homedir(), "AppData", "Roaming");
    return join(appData, "TimeManage MCP", "config.json");
  }
  return join(homedir(), ".config", "timemanage-mcp", "config.json");
};
var readJsonConfig = (path) => {
  if (!path) return {};
  const resolved = resolve(path);
  if (!existsSync(resolved)) {
    throw new Error(`TimeManage config file not found: ${resolved}`);
  }
  return JSON.parse(readFileSync(resolved, "utf8"));
};
var firstValue = (...values) => values.find((value) => value !== void 0 && value.trim() !== "")?.trim();
function loadConfig(env = process.env) {
  const configPath = env.TM_MCP_CONFIG || (existsSync(defaultConfigPath()) ? defaultConfigPath() : void 0);
  const fileConfig = readJsonConfig(configPath);
  const serverUrl = firstValue(env.TM_MCP_SERVER_URL, fileConfig.serverUrl, "http://127.0.0.1:8787");
  const email = firstValue(env.TM_MCP_EMAIL, fileConfig.email);
  const password = firstValue(env.TM_MCP_PASSWORD, fileConfig.password);
  const deviceId = firstValue(env.TM_MCP_DEVICE_ID, fileConfig.deviceId, `timemanage_cli_${hostname()}`);
  if (!email || !password) {
    throw new Error("TimeManage CLI requires account and password via local config or environment.");
  }
  return { serverUrl, email, password, deviceId };
}

// src/defaultBackendServerUrl.ts
var mountedApiBaseFromBuiltAssets = (origin) => {
  const script = document.querySelector('script[type="module"][src*="/assets/"]');
  const src = script?.getAttribute("src");
  if (!src) return "";
  const scriptPath = new URL(src, origin).pathname;
  const assetsIndex = scriptPath.indexOf("/assets/");
  if (assetsIndex <= 0) return "";
  const basePath = scriptPath.slice(0, assetsIndex).replace(/\/+$/, "");
  return basePath ? `${origin}${basePath}/api` : "";
};
var defaultBackendServerUrl = () => {
  if (typeof window === "undefined") return "http://127.0.0.1:8787";
  const { protocol, hostname: hostname2, origin } = window.location;
  if (protocol === "http:" || protocol === "https:") {
    const isLocalHost = hostname2 === "127.0.0.1" || hostname2 === "localhost" || hostname2 === "::1";
    if (!isLocalHost) return mountedApiBaseFromBuiltAssets(origin) || origin;
  }
  return "http://127.0.0.1:8787";
};

// src/initialSeedData.ts
var now = () => (/* @__PURE__ */ new Date()).toISOString();
var starterProject = {
  id: "project_starter",
  name: "TimeManage \u56E2\u961F\u8FDB\u5EA6",
  description: "\u4ECE\u4E2A\u4EBA\u65F6\u95F4\u7BA1\u7406\u8FC1\u79FB\u800C\u6765\u7684\u56E2\u961F\u8FDB\u5EA6\u7BA1\u63A7\u8D77\u59CB\u9879\u76EE\u3002",
  defaultExpectedStartHours: 24,
  taskStageMode: "software",
  sortOrder: 0,
  createdAt: now(),
  updatedAt: now()
};
var starterProjectMember = {
  id: "member_owner",
  projectId: starterProject.id,
  accountId: "account_owner",
  name: "\u9879\u76EE\u8D1F\u8D23\u4EBA",
  email: "owner@example.com",
  roles: ["project_owner", "executor"],
  status: "active",
  createdAt: now(),
  updatedAt: now()
};
var defaultTaskTemplates = [
  {
    id: "template_morning_plan",
    name: "\u6668\u95F4\u8BA1\u5212",
    description: "\u542F\u52A8\u5F53\u5929\u627F\u8BFA\u3001\u68C0\u67E5\u63D0\u9192\u3001\u7559\u51FA\u7F13\u51B2\u3002",
    project: "\u4E2A\u4EBA\u8282\u594F",
    tags: ["\u8BA1\u5212", "\u6668\u95F4"],
    priority: "high",
    severity: "medium",
    estimatePomodoros: 1,
    subtasks: ["\u67E5\u770B\u6628\u65E5\u8FDB\u5C55", "\u9009\u62E9\u4ECA\u65E5 1-3 \u4E2A\u627F\u8BFA", "\u5F00\u542F\u7B2C\u4E00\u9897\u756A\u8304"],
    repeatRule: "daily"
  },
  {
    id: "template_weekly_sync",
    name: "\u5468\u8BA1\u5212\u534F\u4F5C",
    description: "\u6574\u7406\u672C\u5468\u8FDB\u5C55\u3001\u98CE\u9669\u548C\u4E0B\u5468\u5B89\u6392\u3002",
    project: "\u534F\u4F5C",
    tags: ["\u5468\u4F1A", "\u8BA1\u5212"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 2,
    subtasks: ["\u6574\u7406\u5DF2\u5B8C\u6210\u4E8B\u9879", "\u5217\u51FA\u4E3B\u8981\u98CE\u9669", "\u786E\u8BA4\u4E0B\u5468\u5B89\u6392"],
    repeatRule: "weekly"
  },
  {
    id: "template_deep_dev",
    name: "\u5F00\u53D1\u4E13\u6CE8",
    description: "\u7528\u4E8E\u9700\u8981\u8FDE\u7EED\u63A8\u8FDB\u7684\u5F00\u53D1\u4EFB\u52A1\u3002",
    project: "\u5F00\u53D1",
    tags: ["\u5F00\u53D1", "\u6DF1\u5EA6\u5DE5\u4F5C"],
    priority: "high",
    severity: "high",
    estimatePomodoros: 4,
    subtasks: ["\u660E\u786E\u9A8C\u6536\u70B9", "\u5B9E\u73B0\u6700\u5C0F\u95ED\u73AF", "\u8FD0\u884C\u6D4B\u8BD5", "\u8BB0\u5F55\u9057\u7559\u95EE\u9898"]
  },
  {
    id: "template_learning",
    name: "\u5B66\u4E60\u8BA1\u5212",
    description: "\u8BFB\u8D44\u6599\u3001\u505A\u7B14\u8BB0\u3001\u8F93\u51FA\u7EC3\u4E60\u3002",
    project: "\u5B66\u4E60",
    tags: ["\u5B66\u4E60", "\u8F93\u5165"],
    priority: "medium",
    severity: "medium",
    estimatePomodoros: 3,
    subtasks: ["\u9605\u8BFB\u8D44\u6599", "\u6574\u7406\u7B14\u8BB0", "\u505A\u4E00\u6B21\u8F93\u51FA\u7EC3\u4E60"]
  }
];

// src/seed.ts
var todayKey = (date = /* @__PURE__ */ new Date()) => date.toISOString().slice(0, 10);
var uid = (prefix) => {
  const value = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
};
var now2 = () => (/* @__PURE__ */ new Date()).toISOString();
var createInitialState = () => ({
  version: 2,
  settings: {
    focusMinutes: 25,
    shortBreakMinutes: 5,
    longBreakMinutes: 15,
    longBreakEvery: 4,
    autoStartBreaks: false,
    autoStartFocus: false,
    notificationsEnabled: true,
    soundEnabled: true,
    whiteNoise: "off",
    whiteNoiseVolume: 35,
    timerEndSound: "soft",
    notificationSettings: {
      permissionState: "unknown"
    },
    advancedBackendVisible: false,
    commandPaletteHintDismissed: false
  },
  auth: {
    status: "signed_out",
    bootstrapped: void 0,
    message: "\u8BF7\u4F7F\u7528\u7BA1\u7406\u5458\u5206\u914D\u7684\u8D26\u53F7\u767B\u5F55"
  },
  projects: [starterProject],
  projectMembers: [starterProjectMember],
  tasks: [],
  dailyPlans: [],
  focusSessions: [],
  workSessions: [],
  executionSignals: [],
  interruptions: [],
  rewardState: {
    streak: 0,
    dailyGoal: 8,
    badges: ["\u9996\u4E2A\u627F\u8BFA"],
    focusGarden: 0,
    visualProgress: 0
  },
  backend: {
    serverUrl: defaultBackendServerUrl(),
    username: "admin",
    deviceId: uid("device"),
    status: "idle",
    message: "\u672C\u5730\u56E2\u961F\u540E\u53F0\u672A\u8FDE\u63A5"
  },
  taskTemplates: defaultTaskTemplates,
  templateInstances: [],
  updatedAt: now2()
});

// src/appClock.ts
var nowIso = () => (/* @__PURE__ */ new Date()).toISOString();
var today = () => todayKey();

// src/appTaskMetadata.ts
var regularTaskStageOptions = [
  { value: "planning", label: "\u89C4\u5212" },
  { value: "execution", label: "\u6267\u884C" },
  { value: "check", label: "\u68C0\u67E5" }
];
var softwareTaskStageOptions = [
  { value: "sales", label: "\u9500\u552E" },
  { value: "requirements", label: "\u9700\u6C42" },
  { value: "design", label: "\u8BBE\u8BA1" },
  { value: "development", label: "\u5F00\u53D1" },
  { value: "testing", label: "\u6D4B\u8BD5" },
  { value: "deployment", label: "\u90E8\u7F72" },
  { value: "acceptance", label: "\u9A8C\u6536" }
];
var taskStageOptions = [
  ...regularTaskStageOptions,
  ...softwareTaskStageOptions
];
var regularTaskStageValues = new Set(regularTaskStageOptions.map((option) => option.value));
var defaultTaskStageForMode = (mode) => mode === "regular" ? "planning" : "requirements";
var labelTaskStage = Object.fromEntries(taskStageOptions.map((option) => [option.value, option.label]));
var emptyTaskDefaults = (timestamp, sortOrder) => ({
  subtasks: [],
  sortOrder,
  actualPomodoros: 0,
  estimateHistory: [],
  repeatRule: "none",
  createdAt: timestamp,
  updatedAt: timestamp
});

// src/workSessionSignals.ts
var createExecutionSignal = (workSession, type, timestamp, payload, idFactory = uid) => ({
  id: idFactory("signal"),
  workspaceId: workSession.workspaceId,
  workSessionId: workSession.id,
  taskId: workSession.taskId,
  executorMemberId: workSession.executorMemberId,
  type,
  createdAt: timestamp,
  payload
});
var sortedByUpdatedAt = (items) => [...items].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

// src/workSessionQueries.ts
var latestActiveOrPausedWorkSession = (state, taskId, workSessionId) => sortedByUpdatedAt(state.workSessions).filter((session) => session.status === "active" || session.status === "paused").find((session) => (workSessionId ? session.id === workSessionId : true) && (taskId ? session.taskId === taskId : true));

// src/memberIdentity.ts
var normalizedEmail = (email) => email?.trim().toLowerCase();
var isActiveProjectMember = (member) => member.status !== "disabled";
var sameMemberIdentity = (left, right) => {
  if (left.id === right.id) return true;
  if (left.accountId && right.accountId && left.accountId === right.accountId) return true;
  if (left.email && right.email && left.email.toLowerCase() === right.email.toLowerCase()) return true;
  return false;
};
var projectMemberMatchesAccount = (_state, member, account) => {
  const accountEmail = normalizedEmail(account.email);
  return Boolean(
    member.accountId === account.id || accountEmail && normalizedEmail(member.email) === accountEmail
  );
};
var currentProjectMemberForAccount = (state) => {
  const account = state.auth.account;
  if (!account) return void 0;
  return state.projectMembers.find((member) => isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account));
};
var resolveCurrentMember = (state) => state.auth.account ? currentProjectMemberForAccount(state) : state.projectMembers.find(isActiveProjectMember);
var resolveMemberForProject = (state, projectId) => {
  const account = state.auth.account;
  if (account) {
    return state.projectMembers.find(
      (member) => member.projectId === projectId && isActiveProjectMember(member) && projectMemberMatchesAccount(state, member, account)
    );
  }
  const currentMember = resolveCurrentMember(state);
  if (!currentMember) return void 0;
  if (currentMember.projectId === projectId && isActiveProjectMember(currentMember)) return currentMember;
  return state.projectMembers.find(
    (member) => member.projectId === projectId && isActiveProjectMember(member) && sameMemberIdentity(member, currentMember)
  );
};
var resolveMemberIdForProject = (state, projectId) => resolveMemberForProject(state, projectId)?.id;
var projectMemberIdentityIds = (state, currentMember = resolveCurrentMember(state)) => {
  if (!currentMember) return /* @__PURE__ */ new Set();
  return new Set(
    state.projectMembers.filter((member) => isActiveProjectMember(member) && sameMemberIdentity(member, currentMember)).map((member) => member.id)
  );
};

// src/teamProgressUtils.ts
var cleanRoles = (roles) => roles.filter((role, index) => roles.indexOf(role) === index);
var normalizedEmail2 = (email) => email?.trim().toLowerCase();
var clampProgressPercent = (value) => {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value ?? 0)));
};

// src/projectMemberState.ts
function addProjectMemberToState(state, projectId, name, email, roles, timestamp = (/* @__PURE__ */ new Date()).toISOString(), idFactory = uid, identity = {}) {
  const project = state.projects.find((item) => item.id === projectId);
  const workspaceId = project?.workspaceId ?? identity.workspaceId ?? state.auth.workspace?.id;
  const normalizedName = name.trim() || "\u65B0\u6210\u5458";
  const normalizedMemberEmail = email.trim() || void 0;
  const existing = state.projectMembers.find(
    (member) => member.projectId === projectId && member.status !== "disabled" && (identity.accountId && member.accountId === identity.accountId || normalizedMemberEmail && normalizedEmail2(member.email) === normalizedEmail2(normalizedMemberEmail) || member.name === normalizedName)
  );
  if (existing) {
    return updateProjectMemberInState(state, {
      ...existing,
      name: normalizedName,
      email: normalizedMemberEmail ?? existing.email,
      roles,
      status: "active"
    }, timestamp);
  }
  return {
    ...state,
    projectMembers: [
      {
        id: idFactory("member"),
        workspaceId,
        projectId,
        accountId: identity.accountId,
        name: normalizedName,
        email: normalizedMemberEmail,
        roles: cleanRoles(roles).length ? cleanRoles(roles) : ["executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projectMembers
    ],
    updatedAt: timestamp
  };
}
function updateProjectMemberInState(state, member, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    projectMembers: state.projectMembers.map(
      (item) => item.id === member.id ? {
        ...member,
        accountId: member.accountId,
        name: member.name,
        email: member.email,
        roles: cleanRoles(member.roles).length ? cleanRoles(member.roles) : ["executor"],
        status: member.status ?? "active",
        updatedAt: timestamp
      } : item
    ),
    updatedAt: timestamp
  };
}
function projectMembersForProject(state, projectId) {
  return state.projectMembers.filter((member) => member.projectId === projectId && member.status !== "disabled");
}

// src/dailyPlanScope.ts
var currentDailyPlanOwnerAccountId = (state) => state.auth.account?.id;
var currentDailyPlanWorkspaceId = (state) => state.auth.workspace?.id ?? state.auth.account?.workspaceId;
var workspaceIdForTask = (state, task) => {
  const project = state.projects.find((item) => item.id === task.projectId);
  return project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
};
var dailyPlanIdForOwnerWorkspaceAndDate = (ownerAccountId, workspaceId, date) => {
  const ownerPart = ownerAccountId ?? "local";
  return workspaceId ? `plan_${ownerPart}_${workspaceId}_${date}` : `plan_${ownerPart}_${date}`;
};
var dailyPlanIdForOwnerAndDate = (ownerAccountId, date) => dailyPlanIdForOwnerWorkspaceAndDate(ownerAccountId, void 0, date);
var dailyPlanIdForDate = (state, date, workspaceId = currentDailyPlanWorkspaceId(state)) => dailyPlanIdForOwnerWorkspaceAndDate(currentDailyPlanOwnerAccountId(state), workspaceId, date);
var dailyPlanBelongsToCurrentAccount = (state, plan) => {
  const ownerAccountId = currentDailyPlanOwnerAccountId(state);
  return ownerAccountId ? plan.ownerAccountId === ownerAccountId : !plan.ownerAccountId;
};
var dailyPlansForCurrentAccount = (state) => state.dailyPlans.filter((plan) => dailyPlanBelongsToCurrentAccount(state, plan));
var dailyPlanBelongsToWorkspace = (plan, workspaceId) => workspaceId ? plan.workspaceId === workspaceId : !plan.workspaceId;
var currentAccountDailyPlansForDate = (state, date) => dailyPlansForCurrentAccount(state).filter((plan) => plan.date === date);
var currentAccountDailyPlanForWorkspaceDate = (state, workspaceId, date) => {
  const candidates = currentAccountDailyPlansForDate(state, date).filter((plan) => dailyPlanBelongsToWorkspace(plan, workspaceId));
  return candidates.find((plan) => plan.id === dailyPlanIdForDate(state, date, workspaceId)) ?? candidates[0];
};
var combinedCurrentAccountDailyPlanForDate = (state, date) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  if (plans.length <= 1) return plans[0];
  const first = plans[0];
  return {
    ...first,
    id: dailyPlanIdForOwnerAndDate(currentDailyPlanOwnerAccountId(state), date),
    workspaceId: void 0,
    capacityPomodoros: plans.reduce((sum, plan) => sum + plan.capacityPomodoros, 0),
    committedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.committedTaskIds))),
    completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0),
    suggestedTaskIds: Array.from(new Set(plans.flatMap((plan) => plan.suggestedTaskIds))),
    updatedAt: plans.reduce((latest, plan) => plan.updatedAt > latest ? plan.updatedAt : latest, first.updatedAt)
  };
};
var currentAccountDailyPlanForDate = (state, date) => {
  const workspacePlan = currentAccountDailyPlanForWorkspaceDate(state, currentDailyPlanWorkspaceId(state), date);
  return workspacePlan ?? combinedCurrentAccountDailyPlanForDate(state, date);
};

// src/domainQueries.ts
var defaultReview = () => ({
  mood: "normal",
  wins: "",
  blockers: "",
  interruptionPattern: "",
  tomorrowFocus: ""
});
var planForDate = (state, date) => combinedCurrentAccountDailyPlanForDate(state, date) ?? currentAccountDailyPlanForDate(state, date);

// src/planningDomain.ts
var taskPriorityScore = (task) => task.priority === "urgent" ? 40 : task.priority === "high" ? 30 : task.priority === "medium" ? 20 : 10;
var dueScore = (task, now3 = /* @__PURE__ */ new Date()) => {
  if (!task.dueAt) return 0;
  const due = new Date(task.dueAt).getTime();
  if (Number.isNaN(due)) return 0;
  const days = Math.ceil((due - now3.getTime()) / 864e5);
  if (days <= 0) return 28;
  if (days <= 1) return 22;
  if (days <= 3) return 14;
  if (days <= 7) return 8;
  return 2;
};
var estimateRiskScore = (task) => {
  const recent = [...task.estimateHistory ?? []].slice(-3);
  const under = recent.filter((entry) => entry.actualPomodoros - entry.estimatedPomodoros >= 2).length;
  return under * 6 + (task.estimatePomodoros > 7 ? 10 : 0);
};
var taskSuggestions = (state, date = todayKey(), limit = 5) => {
  const plan = planForDate(state, date);
  const committedIds = new Set(plan?.committedTaskIds ?? []);
  return [...state.tasks].filter((task) => !committedIds.has(task.id) && (task.status === "pool" || task.status === "in_progress")).map((task) => {
    const score = taskPriorityScore(task) + dueScore(task) + estimateRiskScore(task) - Math.max(0, task.estimatePomodoros - 3);
    const action = task.estimatePomodoros > 7 ? "split" : score < 16 ? "defer" : "commit";
    const reasonParts = [
      task.priority === "urgent" ? "\u7D27\u6025" : task.priority === "high" ? "\u9AD8\u4F18\u5148\u7EA7" : "",
      task.dueAt ? "\u4E34\u8FD1\u5230\u671F" : "",
      task.estimatePomodoros > 7 ? "\u4EFB\u52A1\u8FC7\u5927\uFF0C\u5EFA\u8BAE\u5148\u62C6\u5206" : "",
      estimateRiskScore(task) >= 6 ? "\u5386\u53F2\u5BB9\u6613\u4F4E\u4F30" : ""
    ].filter(Boolean);
    return {
      taskId: task.id,
      score,
      action,
      reason: reasonParts.join(" \xB7 ") || `\u4F30\u7B97 ${task.estimatePomodoros} \u4E2A\u756A\u8304\uFF0C\u9002\u5408\u8865\u5165\u4ECA\u65E5`
    };
  }).sort((left, right) => {
    const leftTask = state.tasks.find((task) => task.id === left.taskId);
    const rightTask = state.tasks.find((task) => task.id === right.taskId);
    return right.score - left.score || (leftTask?.sortOrder ?? 0) - (rightTask?.sortOrder ?? 0);
  }).slice(0, limit);
};
var suggestedTasks = (state, limit = 5) => taskSuggestions(state, todayKey(), limit).filter((item) => item.action !== "defer").map((item) => item.taskId);

// src/progressBoardRisks.ts
var expectedStartForTask = (state, task) => {
  if (task.expectedStartAt) return task.expectedStartAt;
  if (!task.primaryExecutorMemberId) return void 0;
  const project = state.projects.find((item) => item.id === task.projectId);
  const hours = project?.defaultExpectedStartHours;
  if (!hours) return void 0;
  return new Date(new Date(task.createdAt).getTime() + hours * 36e5).toISOString();
};
var latestTaskSignalAt = (state, task) => {
  const values = [
    ...state.executionSignals.filter((signal) => signal.taskId === task.id).map((signal) => signal.createdAt),
    ...state.workSessions.filter((session) => session.taskId === task.id).flatMap((session) => [session.startedAt, session.pausedAt, session.endedAt].filter((value) => Boolean(value))),
    task.progressPercent || task.progressNote ? task.updatedAt : void 0
  ].filter((value) => Boolean(value));
  const sorted = values.sort();
  return sorted[sorted.length - 1];
};
var stalledTaskRisks = (state, now3 = /* @__PURE__ */ new Date()) => {
  const nowTime = now3.getTime();
  const staleAfterMs = 24 * 36e5;
  return state.tasks.filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "split" && task.status !== "archived").flatMap((task) => {
    const expectedStartAt = expectedStartForTask(state, task);
    const expectedFinishAt = task.expectedFinishAt;
    const workAfterExpectedStart = expectedStartAt ? state.workSessions.some((session) => session.taskId === task.id && new Date(session.startedAt).getTime() >= new Date(expectedStartAt).getTime()) : true;
    if (expectedStartAt && nowTime > new Date(expectedStartAt).getTime() && !workAfterExpectedStart) {
      return [{
        taskId: task.id,
        kind: "not_started",
        expectedStartAt,
        expectedFinishAt,
        detail: "\u5DF2\u8D85\u8FC7\u9884\u8BA1\u5F00\u59CB\u65F6\u95F4\uFF0C\u4F46\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u4F1A\u8BDD\u3002"
      }];
    }
    const latestSignalAt = latestTaskSignalAt(state, task);
    if (expectedFinishAt && nowTime > new Date(expectedFinishAt).getTime() && (task.progressPercent ?? 0) < 100) {
      return [{
        taskId: task.id,
        kind: "finish_late",
        expectedStartAt,
        expectedFinishAt,
        latestSignalAt,
        detail: "\u5DF2\u8D85\u8FC7\u9884\u8BA1\u5B8C\u6210\u65F6\u95F4\uFF0C\u4E14\u8FDB\u5EA6\u672A\u5230 100%\u3002"
      }];
    }
    if ((task.status === "in_progress" || state.workSessions.some((session) => session.taskId === task.id)) && latestSignalAt) {
      const latestTime = new Date(latestSignalAt).getTime();
      if (nowTime - latestTime > staleAfterMs && (task.progressPercent ?? 0) < 100) {
        return [{
          taskId: task.id,
          kind: "started_stale",
          expectedStartAt,
          expectedFinishAt,
          latestSignalAt,
          detail: "\u4EFB\u52A1\u5DF2\u7ECF\u5F00\u59CB\uFF0C\u4F46\u8D85\u8FC7 24 \u5C0F\u65F6\u6CA1\u6709\u65B0\u7684\u6267\u884C\u6216\u8FDB\u5C55\u4FE1\u53F7\u3002"
        }];
      }
    }
    return [];
  }).sort((left, right) => {
    const order = { not_started: 0, finish_late: 1, started_stale: 2 };
    return order[left.kind] - order[right.kind] || (left.expectedFinishAt ?? left.expectedStartAt ?? "").localeCompare(right.expectedFinishAt ?? right.expectedStartAt ?? "");
  });
};

// src/progressBoard.ts
var memberName = (state, memberId) => memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : void 0;
var boardTask = (state, task, detail) => ({
  taskId: task.id,
  title: task.title,
  executorName: memberName(state, task.primaryExecutorMemberId),
  progressPercent: task.progressPercent ?? 0,
  progressNote: task.progressNote,
  expectedStartAt: expectedStartForTask(state, task),
  expectedFinishAt: task.expectedFinishAt,
  detail
});
var isBlockedTask = (task) => /阻塞|卡住|blocked|blocker|等待/i.test(`${task.progressNote ?? ""} ${task.reviewReturnReason ?? ""}`);
var nearExpectedFinish = (task, now3) => {
  if (!task.expectedFinishAt || (task.progressPercent ?? 0) >= 100) return false;
  const finish = new Date(task.expectedFinishAt).getTime();
  if (Number.isNaN(finish)) return false;
  const diff = finish - now3.getTime();
  return diff >= 0 && diff <= 24 * 36e5;
};
var hasAnyWorkSession = (sessions, task) => sessions.some((session) => session.taskId === task.id);
var buildProgressBoard = (state, projectId, now3 = /* @__PURE__ */ new Date()) => {
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  const tasks = state.tasks.filter((task) => task.projectId === project?.id && task.status !== "archived" && task.status !== "split");
  const progressTasks = tasks.filter((task) => task.status !== "archived" && task.status !== "split");
  const totalWeight = progressTasks.reduce((sum, task) => sum + Math.max(1, task.estimatePomodoros || 1), 0);
  const weightedProgress = totalWeight ? Math.round(progressTasks.reduce((sum, task) => sum + (task.progressPercent ?? (task.status === "completed" ? 100 : 0)) * Math.max(1, task.estimatePomodoros || 1), 0) / totalWeight) : 0;
  const projectSessions = state.workSessions.filter(
    (session) => session.status === "active" && tasks.some((task) => task.id === session.taskId)
  );
  const stalledByTask = new Map(stalledTaskRisks(state, now3).filter((risk) => tasks.some((task) => task.id === risk.taskId)).map((risk) => [risk.taskId, risk]));
  const assignedNotStarted = tasks.filter((task) => task.primaryExecutorMemberId && task.status !== "completed" && task.status !== "pending_review" && !hasAnyWorkSession(state.workSessions, task)).map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "\u5DF2\u5206\u914D\uFF0C\u4F46\u8FD8\u6CA1\u6709\u5DE5\u4F5C\u4F1A\u8BDD\u3002"));
  const assignedNotStartedIds = new Set(assignedNotStarted.map((task) => task.taskId));
  const stalled = tasks.filter((task) => stalledByTask.has(task.id) && !assignedNotStartedIds.has(task.id)).map((task) => boardTask(state, task, stalledByTask.get(task.id)?.detail ?? "\u4EFB\u52A1\u51FA\u73B0\u505C\u6EDE\u98CE\u9669\u3002"));
  const stalledIds = new Set(stalled.map((task) => task.taskId));
  const blocked = tasks.filter((task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && isBlockedTask(task)).map((task) => boardTask(state, task, task.reviewReturnReason ? `\u9000\u56DE\u539F\u56E0\uFF1A${task.reviewReturnReason}` : "\u8FDB\u5C55\u8BF4\u660E\u663E\u793A\u4EFB\u52A1\u88AB\u963B\u585E\u3002"));
  const blockedIds = new Set(blocked.map((task) => task.taskId));
  const pendingReview = tasks.filter((task) => task.status === "pending_review" && !blockedIds.has(task.id)).map((task) => boardTask(state, task, "\u7B49\u5F85\u9879\u76EE\u8D1F\u8D23\u4EBA\u9A8C\u6536\u3002"));
  const pendingReviewIds = new Set(pendingReview.map((task) => task.taskId));
  const nearFinish = tasks.filter(
    (task) => !assignedNotStartedIds.has(task.id) && !stalledIds.has(task.id) && !blockedIds.has(task.id) && !pendingReviewIds.has(task.id) && nearExpectedFinish(task, now3)
  ).map((task) => boardTask(state, task, "\u9884\u8BA1\u5B8C\u6210\u65F6\u95F4\u5C06\u5728 24 \u5C0F\u65F6\u5185\u5230\u8FBE\u3002"));
  const riskIds = /* @__PURE__ */ new Set([...assignedNotStartedIds, ...stalledIds, ...blockedIds, ...pendingReviewIds, ...nearFinish.map((task) => task.taskId)]);
  const normal = tasks.filter((task) => task.status !== "completed" && !riskIds.has(task.id)).map((task) => boardTask(state, task, "\u6B63\u5E38\u63A8\u8FDB\u3002"));
  return {
    projectId: project?.id ?? "",
    projectName: project?.name ?? "\u672A\u547D\u540D\u9879\u76EE",
    projectProgress: weightedProgress,
    activeSessions: projectSessions.map((session) => {
      const task = tasks.find((item) => item.id === session.taskId);
      return {
        workSessionId: session.id,
        taskId: session.taskId,
        taskTitle: task?.title ?? "\u672A\u77E5\u4EFB\u52A1",
        executorName: memberName(state, session.executorMemberId),
        startedAt: session.startedAt,
        elapsedSeconds: Math.max(0, Math.round((now3.getTime() - new Date(session.startedAt).getTime()) / 1e3))
      };
    }),
    sections: [
      { kind: "assigned_not_started", title: "\u5DF2\u5206\u914D\u672A\u5F00\u59CB", tasks: assignedNotStarted },
      { kind: "stalled", title: "\u505C\u6EDE\u98CE\u9669", tasks: stalled },
      { kind: "blocked", title: "\u963B\u585E\u4EFB\u52A1", tasks: blocked },
      { kind: "pending_review", title: "\u5F85\u9A8C\u6536", tasks: pendingReview },
      { kind: "near_finish", title: "\u4E34\u8FD1\u9884\u8BA1\u5B8C\u6210", tasks: nearFinish },
      { kind: "normal", title: "\u6B63\u5E38\u5DE5\u4F5C", tasks: normal }
    ]
  };
};

// src/appTodayPlan.ts
var createDailyPlanForDate = (state, date, timestamp = nowIso(), workspaceId = currentDailyPlanWorkspaceId(state)) => ({
  id: dailyPlanIdForDate(state, date, workspaceId),
  workspaceId,
  ownerAccountId: currentDailyPlanOwnerAccountId(state),
  date,
  capacityPomodoros: Math.max(4, state.rewardState.dailyGoal),
  committedTaskIds: [],
  completedPomodoros: 0,
  suggestedTaskIds: date === today() ? suggestedTasks(state) : [],
  reflection: "",
  review: defaultReview(),
  createdAt: timestamp,
  updatedAt: timestamp
});
var getTodayPlan = (state) => {
  const todayDate = today();
  const existing = combinedCurrentAccountDailyPlanForDate(state, todayDate) ?? currentAccountDailyPlanForDate(state, todayDate);
  if (existing) return existing;
  return createDailyPlanForDate(state, todayDate);
};

// src/workSessionTodayPlan.ts
var ensurePlanInState = (state, date, timestamp, workspaceId = currentDailyPlanWorkspaceId(state)) => {
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  if (existing) return { state, plan: existing };
  const plan = createDailyPlanForDate(state, date, timestamp, workspaceId);
  return { state: { ...state, dailyPlans: [plan, ...state.dailyPlans], updatedAt: timestamp }, plan };
};
var ensureTodayPlanInState = (state, timestamp, workspaceId = currentDailyPlanWorkspaceId(state)) => ensurePlanInState(state, todayKey(), timestamp, workspaceId);
var currentProjectMemberIdForTask = (state, task) => {
  return resolveMemberIdForProject(state, task.projectId);
};
var taskHasAssignee = (task) => Boolean(task.primaryExecutorMemberId || (task.collaboratorMemberIds ?? []).length > 0);
var currentWorkspaceMembershipForTask = (state, task) => {
  const account = state.auth.account;
  if (!account) return void 0;
  const project = state.projects.find((item) => item.id === task.projectId);
  const workspaceId = project?.workspaceId ?? task.workspaceId ?? currentDailyPlanWorkspaceId(state);
  return state.auth.workspaceMemberships?.find(
    (membership) => membership.status === "active" && membership.accountId === account.id && (!workspaceId || membership.workspaceId === workspaceId)
  ) ?? (state.auth.membership?.status === "active" && state.auth.membership.accountId === account.id && (!workspaceId || state.auth.membership.workspaceId === workspaceId) ? state.auth.membership : void 0);
};
var ensureCurrentProjectMemberForTask = (state, task, timestamp) => {
  const currentMemberId = currentProjectMemberIdForTask(state, task);
  if (currentMemberId) return { state, memberId: currentMemberId };
  const account = state.auth.account;
  const membership = currentWorkspaceMembershipForTask(state, task);
  if (!account || !membership) return { state, memberId: void 0 };
  const project = state.projects.find((item) => item.id === task.projectId);
  const nextState = addProjectMemberToState(
    state,
    task.projectId,
    account.name || membership.name,
    account.email || membership.email,
    ["executor"],
    timestamp,
    uid,
    {
      accountId: account.id,
      workspaceId: project?.workspaceId ?? task.workspaceId ?? membership.workspaceId
    }
  );
  return { state: nextState, memberId: currentProjectMemberIdForTask(nextState, task) };
};
var claimTaskForCurrentMemberIfUnassigned = (state, task) => {
  if (taskHasAssignee(task)) return task.primaryExecutorMemberId;
  return currentProjectMemberIdForTask(state, task);
};
var addTaskToTodayInState = (state, taskId, timestamp) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  const stateWithMember = taskHasAssignee(task) ? state : ensureCurrentProjectMemberForTask(state, task, timestamp).state;
  const taskForPlan = stateWithMember.tasks.find((item) => item.id === taskId) ?? task;
  const { state: withPlan, plan } = ensureTodayPlanInState(stateWithMember, timestamp, workspaceIdForTask(stateWithMember, taskForPlan));
  const committedTaskIds = Array.from(/* @__PURE__ */ new Set([...plan.committedTaskIds, taskId]));
  return {
    ...withPlan,
    tasks: withPlan.tasks.map(
      (item) => item.id === taskId ? {
        ...item,
        primaryExecutorMemberId: claimTaskForCurrentMemberIfUnassigned(withPlan, item),
        status: item.status === "pool" ? "committed" : item.status,
        updatedAt: timestamp
      } : item
    ),
    dailyPlans: withPlan.dailyPlans.map((item) => item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item),
    updatedAt: timestamp
  };
};
var claimTodayPlanTasksForCurrentMemberInState = (state, plan, timestamp) => {
  let nextState = state;
  let changed = false;
  for (const taskId of plan.committedTaskIds) {
    const task = nextState.tasks.find((item) => item.id === taskId);
    if (!task || taskHasAssignee(task)) continue;
    const withMember = ensureCurrentProjectMemberForTask(nextState, task, timestamp);
    if (!withMember.memberId) continue;
    nextState = {
      ...withMember.state,
      tasks: withMember.state.tasks.map(
        (item) => item.id === task.id ? { ...item, primaryExecutorMemberId: withMember.memberId, updatedAt: timestamp } : item
      ),
      updatedAt: timestamp
    };
    changed = true;
  }
  return changed ? nextState : state;
};

// src/workSessionTermination.ts
var endActiveWorkSessionsForTaskInState = (state, taskId, timestamp, options = {}) => {
  const sessionsToEnd = state.workSessions.filter(
    (session) => session.taskId === taskId && (session.status === "active" || session.status === "paused")
  );
  const shouldClearActiveTimer = options.clearActiveTimer && state.activeTimer?.taskId === taskId;
  if (sessionsToEnd.length === 0 && !shouldClearActiveTimer) return state;
  const endedSessionIds = new Set(sessionsToEnd.map((session) => session.id));
  const endedFocusSessionIds = new Set(sessionsToEnd.map((session) => session.focusSessionId).filter(Boolean));
  const nextWorkSessions = state.workSessions.map(
    (session) => endedSessionIds.has(session.id) ? {
      ...session,
      status: "ended",
      pausedAt: void 0,
      endedAt: timestamp,
      totalPausedSeconds: options.activeTimerWorkSessionId === session.id && options.activeTimerTotalPausedSeconds !== void 0 ? options.activeTimerTotalPausedSeconds : session.totalPausedSeconds,
      updatedAt: timestamp
    } : session
  );
  const endedWorkSessions = nextWorkSessions.filter((session) => endedSessionIds.has(session.id));
  const reason = options.reason ?? "removed_from_today";
  return {
    ...state,
    focusSessions: state.focusSessions.map(
      (session) => endedFocusSessionIds.has(session.id) && !session.endedAt ? { ...session, endedAt: timestamp, outcome: "skipped" } : session
    ),
    workSessions: nextWorkSessions,
    executionSignals: [
      ...endedWorkSessions.map(
        (session) => createExecutionSignal(
          session,
          "work_ended",
          timestamp,
          { outcome: "skipped", reason, ...options.source ? { source: options.source } : {} },
          options.idFactory
        )
      ),
      ...state.executionSignals
    ],
    activeTimer: shouldClearActiveTimer ? void 0 : state.activeTimer,
    updatedAt: timestamp
  };
};

// src/workSessionStart.ts
var startWorkSessionInState = (state, taskId, timestamp, options = {}) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status === "pending_review" || task.status === "completed" || task.status === "archived" || task.status === "split") {
    throw new Error(`Task ${taskId} cannot be started from status ${task.status}.`);
  }
  const next = addTaskToTodayInState(state, taskId, timestamp);
  const currentTask = next.tasks.find((item) => item.id === taskId);
  const executorMemberId = currentTask.primaryExecutorMemberId ?? resolveMemberIdForProject(next, currentTask.projectId);
  const activeForExecutor = executorMemberId ? next.workSessions.find((session) => session.status === "active" && session.executorMemberId === executorMemberId) : void 0;
  if (activeForExecutor?.taskId === taskId) return next;
  const endedSession = activeForExecutor ? {
    ...activeForExecutor,
    status: "ended",
    pausedAt: void 0,
    endedAt: timestamp,
    updatedAt: timestamp
  } : void 0;
  const idFactory = options.idFactory ?? uid;
  const workspaceId = currentTask.workspaceId ?? state.projects.find((project) => project.id === currentTask.projectId)?.workspaceId ?? next.auth.workspace?.id;
  const focusSession = {
    id: idFactory("session"),
    workspaceId,
    taskId,
    mode: "focus",
    duration: next.settings.focusMinutes * 60,
    startedAt: timestamp,
    interruptionCounts: { internal: 0, external: 0 }
  };
  const workSession = {
    id: idFactory("work_session"),
    workspaceId,
    taskId,
    executorMemberId,
    focusSessionId: focusSession.id,
    status: "active",
    startedAt: timestamp,
    totalPausedSeconds: 0,
    createdAt: timestamp,
    updatedAt: timestamp
  };
  const signals = [
    createExecutionSignal(workSession, "work_started", timestamp, options.source ? { source: options.source } : void 0, idFactory),
    ...endedSession ? [createExecutionSignal(endedSession, "work_ended", timestamp, { outcome: "skipped", reason: "task_switch" }, idFactory)] : []
  ];
  return {
    ...next,
    focusSessions: [focusSession, ...next.focusSessions],
    workSessions: [
      workSession,
      ...next.workSessions.map((session) => endedSession && session.id === endedSession.id ? endedSession : session)
    ],
    executionSignals: [...signals, ...next.executionSignals],
    tasks: next.tasks.map((item) => item.id === taskId ? { ...item, status: "in_progress", updatedAt: timestamp } : item),
    updatedAt: timestamp
  };
};

// src/workSessionPauseResume.ts
var pauseWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "paused") return state;
  const nextSession = { ...session, status: "paused", pausedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    executionSignals: [
      createExecutionSignal(nextSession, "work_paused", timestamp, options.source ? { source: options.source } : void 0, options.idFactory),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};
var resumeWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  if (session.status === "active") return state;
  const pausedSeconds = session.pausedAt ? Math.max(0, Math.round((new Date(timestamp).getTime() - new Date(session.pausedAt).getTime()) / 1e3)) : 0;
  const nextSession = {
    ...session,
    status: "active",
    pausedAt: void 0,
    totalPausedSeconds: (session.totalPausedSeconds ?? 0) + pausedSeconds,
    updatedAt: timestamp
  };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    executionSignals: [
      createExecutionSignal(nextSession, "work_resumed", timestamp, options.source ? { source: options.source } : void 0, options.idFactory),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};

// src/workSessionFinish.ts
var finishWorkSessionInState = (state, timestamp, taskId, workSessionId, options = {}) => {
  const session = latestActiveOrPausedWorkSession(state, taskId, workSessionId);
  if (!session) throw new Error("No active or paused work session found.");
  const outcome = options.outcome ?? "completed";
  const nextSession = { ...session, status: "ended", pausedAt: void 0, endedAt: timestamp, updatedAt: timestamp };
  return {
    ...state,
    workSessions: state.workSessions.map((item) => item.id === session.id ? nextSession : item),
    focusSessions: state.focusSessions.map(
      (item) => item.id === session.focusSessionId ? { ...item, endedAt: timestamp, outcome } : item
    ),
    tasks: state.tasks.map(
      (task) => task.id === session.taskId ? {
        ...task,
        status: task.status === "pending_review" ? task.status : "in_progress",
        actualPomodoros: outcome === "completed" ? (task.actualPomodoros ?? 0) + 1 : task.actualPomodoros,
        updatedAt: timestamp
      } : task
    ),
    executionSignals: [
      createExecutionSignal(
        nextSession,
        "work_ended",
        timestamp,
        { outcome, ...options.source ? { source: options.source } : {} },
        options.idFactory
      ),
      ...state.executionSignals
    ],
    updatedAt: timestamp
  };
};

// src/appTimerWorkSession.ts
var endActiveWorkSessionsForTaskInState2 = (state, taskId, timestamp, reason = "removed_from_today") => endActiveWorkSessionsForTaskInState(state, taskId, timestamp, {
  reason,
  activeTimerWorkSessionId: state.activeTimer?.workSessionId,
  activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
  clearActiveTimer: true
});

// src/appTodayPlanState.ts
var removeTaskFromTodayInState = (state, taskId, timestamp) => {
  const endedState = endActiveWorkSessionsForTaskInState2(state, taskId, timestamp);
  return {
    ...endedState,
    dailyPlans: endedState.dailyPlans.map(
      (item) => item.date === today() && dailyPlanBelongsToCurrentAccount(endedState, item) && item.committedTaskIds.includes(taskId) ? {
        ...item,
        committedTaskIds: item.committedTaskIds.filter((id) => id !== taskId),
        updatedAt: timestamp
      } : item
    ),
    tasks: endedState.tasks.map(
      (task) => task.id === taskId && task.status === "committed" ? { ...task, status: "pool", updatedAt: timestamp } : task
    ),
    updatedAt: timestamp
  };
};
var claimCurrentAccountTodayPlans = (state, date, timestamp) => currentAccountDailyPlansForDate(state, date).reduce(
  (current, plan) => claimTodayPlanTasksForCurrentMemberInState(current, plan, timestamp),
  state
);
var ensureTodayPlan = (state) => {
  const todayDate = today();
  const timestamp = nowIso();
  const activeTimer = state.activeTimer;
  const activeTimerTask = activeTimer?.mode === "focus" && activeTimer.taskId ? state.tasks.find((task) => task.id === activeTimer.taskId) : void 0;
  const hasActiveTimerWorkSession = Boolean(
    activeTimer && state.workSessions.some(
      (session) => activeTimer.workSessionId ? session.id === activeTimer.workSessionId : session.focusSessionId === activeTimer.sessionId
    )
  );
  const repairedState = activeTimer && activeTimerTask && !hasActiveTimerWorkSession ? (() => {
    const workSession = {
      id: activeTimer.workSessionId ?? uid("work_session"),
      taskId: activeTimerTask.id,
      executorMemberId: activeTimerTask.primaryExecutorMemberId ?? resolveMemberIdForProject(state, activeTimerTask.projectId),
      focusSessionId: activeTimer.sessionId,
      status: activeTimer.isRunning ? "active" : "paused",
      startedAt: activeTimer.startedAt,
      pausedAt: activeTimer.pausedAt,
      totalPausedSeconds: activeTimer.totalPausedSeconds,
      createdAt: activeTimer.startedAt,
      updatedAt: timestamp
    };
    return {
      ...state,
      workSessions: [workSession, ...state.workSessions],
      executionSignals: [createExecutionSignal(workSession, "work_started", timestamp, { source: "active_timer_repair" }), ...state.executionSignals],
      activeTimer: { ...activeTimer, workSessionId: workSession.id },
      updatedAt: timestamp
    };
  })() : state;
  const staleActiveTaskIds = repairedState.workSessions.filter((session) => (session.status === "active" || session.status === "paused") && session.startedAt.slice(0, 10) !== todayDate).map((session) => session.taskId);
  const normalizedState = staleActiveTaskIds.reduce(
    (current, taskId) => endActiveWorkSessionsForTaskInState2(current, taskId, timestamp, "stale_active_session"),
    repairedState
  );
  const activeTaskIds = normalizedState.workSessions.filter((session) => session.status === "active" || session.status === "paused").map((session) => session.taskId).filter(
    (taskId) => normalizedState.tasks.some(
      (task) => task.id === taskId && task.status !== "completed" && task.status !== "split" && task.status !== "archived"
    )
  );
  let withActiveTasks = normalizedState;
  for (const taskId of activeTaskIds) {
    const task = withActiveTasks.tasks.find((item) => item.id === taskId);
    const { state: withPlan, plan } = ensurePlanInState(withActiveTasks, todayDate, timestamp, task ? workspaceIdForTask(withActiveTasks, task) : void 0);
    withActiveTasks = plan.committedTaskIds.includes(taskId) ? withPlan : {
      ...withPlan,
      dailyPlans: withPlan.dailyPlans.map(
        (item) => item.id === plan.id ? {
          ...item,
          committedTaskIds: Array.from(/* @__PURE__ */ new Set([...item.committedTaskIds, taskId])),
          updatedAt: timestamp
        } : item
      ),
      updatedAt: timestamp
    };
  }
  if (currentAccountDailyPlansForDate(withActiveTasks, todayDate).length === 0) {
    withActiveTasks = ensurePlanInState(withActiveTasks, todayDate, timestamp).state;
  }
  return claimCurrentAccountTodayPlans(withActiveTasks, todayDate, timestamp);
};

// src/appTaskDeletionState.ts
function deleteTaskFromState(state, task, timestamp) {
  const committedPlanIds = state.dailyPlans.filter((plan) => plan.committedTaskIds.includes(task.id)).map((plan) => plan.id);
  const snapshot = { task, committedPlanIds, deletedAt: timestamp };
  return {
    snapshot,
    state: {
      ...state,
      tasks: state.tasks.filter((item) => item.id !== task.id),
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((id) => id !== task.id)
      })),
      updatedAt: timestamp
    }
  };
}

// src/appTaskSplitState.ts
function splitTaskInState(state, task, titles, timestamp, createTaskId) {
  const currentPlan = getTodayPlan(state);
  const committed = task.status === "committed" || currentPlan.committedTaskIds.includes(task.id);
  const workspaceId = workspaceIdForTask(state, task);
  const estimatePerTask = Math.max(1, Math.ceil(task.estimatePomodoros / titles.length));
  const newTasks = titles.map((title, index) => ({
    id: createTaskId(),
    workspaceId,
    title,
    notes: `\u7531\u300C${task.title}\u300D\u62C6\u5206\u800C\u6765\u3002`,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    creatorMemberId: resolveMemberIdForProject(state, task.projectId) ?? task.creatorMemberId,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    progressPercent: 0,
    progressNote: "",
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    estimatePomodoros: estimatePerTask,
    status: committed ? "committed" : "pool",
    ...emptyTaskDefaults(timestamp, task.sortOrder + index + 1),
    dueAt: task.dueAt,
    reminderAt: index === 0 ? task.reminderAt : void 0,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays
  }));
  return {
    newTasks,
    state: {
      ...state,
      tasks: [
        ...newTasks,
        ...state.tasks.map(
          (item) => item.id === task.id ? {
            ...item,
            status: "split",
            notes: [
              item.notes,
              `\u5DF2\u62C6\u5206\u4E3A\uFF1A${titles.join("\u3001")}\u3002`
            ].filter(Boolean).join("\n"),
            updatedAt: timestamp
          } : item
        )
      ],
      dailyPlans: state.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.flatMap((id) => id === task.id ? newTasks.map((item) => item.id) : [id]),
        updatedAt: plan.committedTaskIds.includes(task.id) ? timestamp : plan.updatedAt
      })),
      updatedAt: timestamp
    }
  };
}

// src/appTaskState.ts
function updateTaskInState(state, taskId, updater, timestamp) {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId) return task;
      const nextTask = typeof updater === "function" ? updater(task) : { ...task, ...updater };
      return { ...nextTask, updatedAt: timestamp };
    }),
    updatedAt: timestamp
  };
}
function moveCommittedTaskInState(state, taskId, direction, timestamp) {
  const plan = currentAccountDailyPlansForDate(state, today()).find((item) => item.committedTaskIds.includes(taskId));
  if (!plan) return state;
  const index = plan.committedTaskIds.indexOf(taskId);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= plan.committedTaskIds.length) return state;
  const committedTaskIds = [...plan.committedTaskIds];
  [committedTaskIds[index], committedTaskIds[nextIndex]] = [committedTaskIds[nextIndex], committedTaskIds[index]];
  return {
    ...state,
    dailyPlans: state.dailyPlans.map(
      (item) => item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item
    ),
    updatedAt: timestamp
  };
}

// src/accessIdentity.ts
var normalizedEmail3 = (email) => email?.trim().toLowerCase();
var memberAccessIdentityKey = (member) => {
  if (member.accountId) return `account:${member.accountId}`;
  if (member.email) return `email:${normalizedEmail3(member.email)}`;
  return `member:${member.id ?? ""}`;
};
var memberAccessIdentityAliases = (member) => {
  const aliases = [];
  if (member.accountId) aliases.push(`account:${member.accountId}`);
  const email = normalizedEmail3(member.email);
  if (email) aliases.push(`email:${email}`);
  if (member.id) aliases.push(`member:${member.id}`);
  return Array.from(new Set(aliases.length ? aliases : [memberAccessIdentityKey(member)]));
};
var addMemberAccessIdentity = (identities, identityAliasToKey, member) => {
  const aliases = memberAccessIdentityAliases(member);
  const existingKey = aliases.map((alias) => identityAliasToKey.get(alias)).find((key) => Boolean(key && identities.has(key)));
  const identityKey = existingKey ?? memberAccessIdentityKey(member);
  aliases.forEach((alias) => identityAliasToKey.set(alias, identityKey));
  identities.add(identityKey);
};
var memberIdentityForProjectMember = (member) => ({
  id: member.id,
  accountId: member.accountId,
  email: member.email
});

// src/workspaceStateAccess.ts
var workspaceMembershipsForState = (state) => {
  const memberships = state.auth.workspaceMemberships ?? [];
  const currentMembership = state.auth.membership;
  if (!currentMembership || memberships.some(
    (membership) => membership.id === currentMembership.id || membership.workspaceId === currentMembership.workspaceId && membership.accountId === currentMembership.accountId
  )) {
    return memberships;
  }
  return [...memberships, currentMembership];
};
var workspacesForState = (state) => state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);
var workspaceForProject = (state, project) => project.workspaceId ? workspacesForState(state).find((item) => item.id === project.workspaceId) ?? state.auth.workspace : state.auth.workspace;
var workspaceIdForProject = (state, project) => project.workspaceId ?? workspaceForProject(state, project)?.id;

// src/workspaceMemberVisibility.ts
var activeWorkspaceIdsForAccount = (state, account) => {
  if (!account?.id) return /* @__PURE__ */ new Set();
  const workspaceMemberships = workspaceMembershipsForState(state);
  const workspaceIds = new Set(
    workspaceMemberships.filter((membership) => membership.accountId === account.id && membership.status === "active").map((membership) => membership.workspaceId)
  );
  workspacesForState(state).filter((workspace) => workspace.ownerAccountId === account.id).forEach((workspace) => workspaceIds.add(workspace.id));
  if (state.auth.workspace?.ownerAccountId === account.id) workspaceIds.add(state.auth.workspace.id);
  return workspaceIds;
};
var activeWorkspaceIdsForCurrentAccount = (state) => activeWorkspaceIdsForAccount(state, state.auth.account);

// src/projectAccessMemberCount.ts
var countProjectAccessibleMembers = (state, project, workspaceId) => {
  const identities = /* @__PURE__ */ new Set();
  const identityAliasToKey = /* @__PURE__ */ new Map();
  if (workspaceId) {
    const workspace = workspacesForState(state).find((item) => item.id === workspaceId);
    if (workspace?.ownerAccountId) addMemberAccessIdentity(identities, identityAliasToKey, { accountId: workspace.ownerAccountId });
    const activeMemberships = workspaceMembershipsForState(state).filter((membership) => membership.workspaceId === workspaceId && membership.status === "active");
    activeMemberships.forEach((membership) => addMemberAccessIdentity(identities, identityAliasToKey, membership));
  }
  state.projectMembers.filter((member) => member.projectId === project.id && member.status !== "disabled").forEach((member) => addMemberAccessIdentity(identities, identityAliasToKey, member));
  return identities.size;
};

// src/projectAccessIdentity.ts
var projectMemberMatchesIdentity = (member, identity) => {
  const identityEmail = normalizedEmail3(identity.email);
  return Boolean(
    identity.accountId && member.accountId === identity.accountId || identityEmail && normalizedEmail3(member.email) === identityEmail
  );
};
var accountIdentity = (account) => ({
  id: account.id,
  accountId: account.id,
  email: account.email
});

// src/projectAccessVisibility.ts
var accountProjectMemberIds = (state, account, currentMember) => {
  if (currentMember) return projectMemberIdentityIds(state, currentMember);
  if (!account) return projectMemberIdentityIds(state, resolveCurrentMember(state));
  return new Set(
    state.projectMembers.filter((member) => member.status !== "disabled" && projectMemberMatchesIdentity(member, accountIdentity(account))).map((member) => member.id)
  );
};
var accessibleProjectIdsForAccount = (state, account, currentMember) => {
  const memberIds = accountProjectMemberIds(state, account, currentMember);
  const workspaceIds = activeWorkspaceIdsForAccount(state, account);
  const projectIds = /* @__PURE__ */ new Set();
  state.projectMembers.filter((member) => member.status !== "disabled" && memberIds.has(member.id)).forEach((member) => projectIds.add(member.projectId));
  state.projects.filter((project) => {
    const workspaceId = workspaceIdForProject(state, project);
    return workspaceId ? workspaceIds.has(workspaceId) : false;
  }).forEach((project) => projectIds.add(project.id));
  return projectIds;
};
var accessibleProjectIdsForCurrentUser = (state, currentMember) => accessibleProjectIdsForAccount(state, state.auth.account, currentMember);

// src/projectDetailTaskCreation.ts
var estimateHoursToPomodoros = (estimateHours, focusMinutes = 25) => {
  const safeFocusMinutes = Math.max(1, Math.round(focusMinutes));
  const safeHours = Math.max(0, estimateHours ?? 1);
  return Math.max(1, Math.ceil(safeHours * 60 / safeFocusMinutes));
};
var createProjectTaskInState = (state, projectId, input, timestamp = nowIso(), idFactory = uid) => {
  const title = input.title.trim();
  const project = state.projects.find((item) => item.id === projectId);
  if (!title || !project) return state;
  const task = {
    id: idFactory("task"),
    workspaceId: project.workspaceId ?? state.auth.workspace?.id,
    title,
    notes: input.notes?.trim() ?? "",
    tags: input.tags ?? [],
    projectId: project.id,
    project: project.name,
    creatorMemberId: resolveMemberIdForProject(state, project.id),
    primaryExecutorMemberId: input.primaryExecutorMemberId || void 0,
    collaboratorMemberIds: input.collaboratorMemberIds?.filter((id) => id !== input.primaryExecutorMemberId) ?? [],
    expectedStartAt: input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt,
    priority: input.priority ?? "medium",
    severity: input.severity ?? "medium",
    stage: input.stage ?? defaultTaskStageForMode(project.taskStageMode ?? "software"),
    estimatePomodoros: input.estimateHours !== void 0 ? estimateHoursToPomodoros(input.estimateHours, state.settings.focusMinutes) : Math.max(1, Math.round(input.estimatePomodoros ?? 1)),
    status: "pool",
    ...emptyTaskDefaults(timestamp, Date.now()),
    dueAt: input.dueAt,
    reminderAt: input.reminderAt,
    repeatRule: input.repeatRule ?? "none",
    repeatIntervalDays: input.repeatIntervalDays,
    subtasks: (input.subtasks ?? []).map((title2) => title2.trim()).filter(Boolean).map((title2) => ({
      id: idFactory("subtask"),
      title: title2,
      completed: false,
      createdAt: timestamp
    }))
  };
  return {
    ...state,
    tasks: [task, ...state.tasks],
    updatedAt: timestamp
  };
};

// src/projectCreateState.ts
var nextProjectSortOrder = (projects) => {
  const orders = projects.map((project) => project.sortOrder).filter((value) => Number.isFinite(value));
  if (orders.length) return Math.max(...orders) + 1e3;
  return projects.length * 1e3;
};
function createProjectInState(state, name, description, timestamp = (/* @__PURE__ */ new Date()).toISOString(), idFactory = uid, owner) {
  const projectId = idFactory("project");
  const memberId = idFactory("member");
  const workspaceId = owner?.workspaceId ?? state.auth.workspace?.id ?? state.projects[0]?.workspaceId;
  const ownerName = owner?.name?.trim() || state.auth.account?.name || "\u9879\u76EE\u8D1F\u8D23\u4EBA";
  const ownerEmail = owner?.email?.trim() || state.auth.account?.email;
  return {
    ...state,
    projects: [
      {
        id: projectId,
        workspaceId,
        name: name.trim() || "\u65B0\u9879\u76EE",
        description: description.trim(),
        defaultExpectedStartHours: 24,
        taskStageMode: owner?.taskStageMode ?? "regular",
        sortOrder: nextProjectSortOrder(state.projects),
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projects
    ],
    projectMembers: [
      {
        id: memberId,
        workspaceId,
        projectId,
        accountId: owner?.accountId ?? state.auth.account?.id,
        name: ownerName,
        email: ownerEmail,
        roles: ["project_owner", "executor"],
        status: "active",
        createdAt: timestamp,
        updatedAt: timestamp
      },
      ...state.projectMembers
    ],
    updatedAt: timestamp
  };
}

// src/projectUpdateState.ts
function updateProjectInState(state, project, timestamp = (/* @__PURE__ */ new Date()).toISOString(), _idFactory = uid) {
  const existingProject = state.projects.find((item) => item.id === project.id);
  const previousWorkspaceId = existingProject?.workspaceId ?? state.auth.workspace?.id;
  const nextWorkspaceId = project.workspaceId;
  const workspaceChanged = Boolean(existingProject && previousWorkspaceId !== nextWorkspaceId);
  const projectTaskIds = new Set(state.tasks.filter((task) => task.projectId === project.id).map((task) => task.id));
  return {
    ...state,
    projects: state.projects.map((item) => item.id === project.id ? { ...project, updatedAt: timestamp } : item),
    projectMembers: state.projectMembers.map(
      (member) => workspaceChanged && member.projectId === project.id ? {
        ...member,
        workspaceId: nextWorkspaceId,
        accountId: member.accountId,
        name: member.name,
        email: member.email,
        status: member.status ?? "active",
        updatedAt: timestamp
      } : member
    ),
    tasks: state.tasks.map(
      (task) => task.projectId === project.id ? {
        ...task,
        workspaceId: nextWorkspaceId,
        project: project.name,
        updatedAt: workspaceChanged || task.project !== project.name ? timestamp : task.updatedAt
      } : task
    ),
    workSessions: state.workSessions.map(
      (session) => workspaceChanged && projectTaskIds.has(session.taskId) ? { ...session, workspaceId: nextWorkspaceId, updatedAt: timestamp } : session
    ),
    executionSignals: state.executionSignals.map(
      (signal) => workspaceChanged && projectTaskIds.has(signal.taskId) ? { ...signal, workspaceId: nextWorkspaceId } : signal
    ),
    focusSessions: state.focusSessions.map(
      (session) => workspaceChanged && session.taskId && projectTaskIds.has(session.taskId) ? { ...session, workspaceId: nextWorkspaceId } : session
    ),
    interruptions: state.interruptions.map(
      (interruption) => workspaceChanged && interruption.taskId && projectTaskIds.has(interruption.taskId) ? { ...interruption, workspaceId: nextWorkspaceId } : interruption
    ),
    updatedAt: timestamp
  };
}

// src/taskAssignmentState.ts
function assignTaskInState(state, taskId, assignment, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  const currentTask = state.tasks.find((task) => task.id === taskId);
  if (!currentTask) return state;
  const projectId = assignment.projectId ?? currentTask.projectId;
  const project = state.projects.find((item) => item.id === projectId) ?? state.projects[0];
  if (!project) return state;
  const projectMembers = projectMembersForProject(state, project.id);
  const executorIds = new Set(projectMembers.filter((member) => member.roles.includes("executor")).map((member) => member.id));
  const memberIds = new Set(projectMembers.map((member) => member.id));
  const primaryExecutorMemberId = assignment.primaryExecutorMemberId && executorIds.has(assignment.primaryExecutorMemberId) ? assignment.primaryExecutorMemberId : assignment.primaryExecutorMemberId === void 0 ? currentTask.primaryExecutorMemberId && executorIds.has(currentTask.primaryExecutorMemberId) ? currentTask.primaryExecutorMemberId : void 0 : void 0;
  const collaboratorMemberIds = Array.from(new Set(assignment.collaboratorMemberIds ?? currentTask.collaboratorMemberIds ?? [])).filter((memberId) => memberIds.has(memberId)).filter((memberId) => memberId !== primaryExecutorMemberId);
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId ? {
        ...task,
        workspaceId: project.workspaceId ?? task.workspaceId,
        projectId: project.id,
        project: project.name,
        primaryExecutorMemberId,
        collaboratorMemberIds,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// src/taskProgressUpdateState.ts
function updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId ? {
        ...task,
        progressPercent: clampProgressPercent(progressPercent),
        progressNote,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// src/taskReviewState.ts
var actualPomodorosForTask = (state, task) => state.focusSessions.filter((session) => session.taskId === task.id && session.outcome === "completed").length || task.actualPomodoros || 0;
function submitTaskForReviewInState(state, taskId, submitterMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  const canSubmitForReview = (task) => task.status === "committed" || task.status === "in_progress";
  const shouldEndActiveWork = state.tasks.some((task) => task.id === taskId && canSubmitForReview(task));
  const submitted = {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId && canSubmitForReview(task) ? {
        ...task,
        status: "pending_review",
        progressPercent: 100,
        actualPomodoros: actualPomodorosForTask(state, task),
        reviewSubmittedAt: timestamp,
        reviewSubmittedByMemberId: submitterMemberId,
        reviewAcceptedAt: void 0,
        reviewAcceptedByMemberId: void 0,
        reviewReturnedAt: void 0,
        reviewReturnedByMemberId: void 0,
        reviewReturnReason: void 0,
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
  if (!shouldEndActiveWork) return submitted;
  return endActiveWorkSessionsForTaskInState(submitted, taskId, timestamp, {
    reason: "submitted_for_review",
    activeTimerWorkSessionId: state.activeTimer?.workSessionId,
    activeTimerTotalPausedSeconds: state.activeTimer?.totalPausedSeconds,
    clearActiveTimer: true
  });
}
function acceptTaskInState(state, taskId, accepterMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map((task) => {
      if (task.id !== taskId || task.status !== "pending_review") return task;
      const actualPomodoros = actualPomodorosForTask(state, task);
      return {
        ...task,
        status: "completed",
        progressPercent: 100,
        actualPomodoros,
        reviewAcceptedAt: timestamp,
        reviewAcceptedByMemberId: accepterMemberId,
        completedAt: timestamp,
        updatedAt: timestamp,
        estimateHistory: [
          ...task.estimateHistory ?? [],
          {
            id: uid("estimate"),
            estimatedPomodoros: task.estimatePomodoros,
            actualPomodoros,
            recordedAt: timestamp,
            source: "completion"
          }
        ]
      };
    }),
    updatedAt: timestamp
  };
}
function returnTaskForReviewInState(state, taskId, reason, reviewerMemberId, timestamp = (/* @__PURE__ */ new Date()).toISOString()) {
  return {
    ...state,
    tasks: state.tasks.map(
      (task) => task.id === taskId && task.status === "pending_review" ? {
        ...task,
        status: "in_progress",
        progressPercent: Math.min(task.progressPercent ?? 0, 99),
        reviewReturnedAt: timestamp,
        reviewReturnedByMemberId: reviewerMemberId,
        reviewReturnReason: reason.trim(),
        updatedAt: timestamp
      } : task
    ),
    updatedAt: timestamp
  };
}

// mcp-server/src/businessGuards.ts
var requireProject = (state, projectId) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  return project;
};
var requireTask = (state, taskId) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return task;
};
var requireMember = (state, projectMemberId) => {
  const member = state.projectMembers.find((item) => item.id === projectMemberId);
  if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
  return member;
};

// mcp-server/src/businessTaskOperations.ts
var createTaskInTeamState = (state, input, timestamp) => {
  requireProject(state, input.projectId);
  return createProjectTaskInState(state, input.projectId, input, timestamp, uid);
};
var updateTaskInTeamState = (state, taskId, input, timestamp) => {
  requireTask(state, taskId);
  return updateTaskInState(state, taskId, (task) => ({
    ...task,
    title: input.title?.trim() || task.title,
    notes: input.notes === void 0 ? task.notes : input.notes.trim(),
    tags: input.tags ?? task.tags,
    priority: input.priority ?? task.priority,
    severity: input.severity ?? task.severity,
    stage: input.stage ?? task.stage,
    estimatePomodoros: input.estimateHours === void 0 ? Math.max(1, Math.round(input.estimatePomodoros ?? task.estimatePomodoros)) : Math.max(1, Math.ceil(Math.max(0, input.estimateHours) * 60 / Math.max(1, state.settings.focusMinutes))),
    expectedStartAt: input.expectedStartAt === void 0 ? task.expectedStartAt : input.expectedStartAt,
    expectedFinishAt: input.expectedFinishAt === void 0 ? task.expectedFinishAt : input.expectedFinishAt,
    dueAt: input.dueAt === void 0 ? task.dueAt : input.dueAt,
    reminderAt: input.reminderAt === void 0 ? task.reminderAt : input.reminderAt,
    repeatRule: input.repeatRule ?? task.repeatRule,
    repeatIntervalDays: input.repeatIntervalDays === void 0 ? task.repeatIntervalDays : input.repeatIntervalDays,
    subtasks: input.subtasks === void 0 ? task.subtasks : input.subtasks.map((title) => title.trim()).filter(Boolean).map((title) => ({ id: uid("subtask"), title, completed: false, createdAt: timestamp }))
  }), timestamp);
};
var deleteTaskInTeamState = (state, taskId, timestamp) => deleteTaskFromState(state, requireTask(state, taskId), timestamp).state;
var assignTaskInTeamState = (state, taskId, assignment, timestamp) => assignTaskInState(state, taskId, assignment, timestamp);
var setTaskStatusInTeamState = (state, taskId, status, timestamp) => updateTaskInState(state, taskId, (task) => ({
  ...task,
  status,
  completedAt: status === "completed" ? task.completedAt ?? timestamp : task.completedAt
}), timestamp);
var updateTaskProgressInTeamState = (state, taskId, progressPercent, progressNote, timestamp) => updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp);
var splitTaskInTeamState = (state, taskId, childTitles, timestamp) => {
  const task = requireTask(state, taskId);
  const titles = childTitles.map((title) => title.trim()).filter(Boolean);
  if (titles.length < 2) throw new Error("split_task requires at least two child titles.");
  return splitTaskInState(state, task, titles, timestamp, () => uid("task")).state;
};
var addTaskToTodayInTeamState = (state, taskId, timestamp) => addTaskToTodayInState(state, taskId, timestamp);
var batchAddTasksToTodayInTeamState = (state, taskIds, timestamp) => taskIds.reduce((current, taskId) => addTaskToTodayInState(current, taskId, timestamp), state);
var removeTaskFromTodayInTeamState = (state, taskId, timestamp) => removeTaskFromTodayInState(state, taskId, timestamp);
var moveTodayTaskInTeamState = (state, taskId, direction, timestamp) => moveCommittedTaskInState(state, taskId, direction, timestamp);
var scheduleTaskForDateInState = (state, taskId, date, timestamp) => {
  const task = requireTask(state, taskId);
  if (date === today()) return addTaskToTodayInState(state, taskId, timestamp);
  const workspaceId = workspaceIdForTask(state, task) ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? {
    ...createDailyPlanForDate(state, date, timestamp, workspaceId),
    capacityPomodoros: state.rewardState.dailyGoal,
    recommendedCapacityPomodoros: state.rewardState.dailyGoal,
    suggestedCapacityPomodoros: state.rewardState.dailyGoal,
    overloadAcknowledged: false
  };
  const nextPlan = {
    ...plan,
    committedTaskIds: Array.from(/* @__PURE__ */ new Set([...plan.committedTaskIds, taskId])),
    updatedAt: timestamp
  };
  return {
    ...state,
    tasks: state.tasks.map((item) => item.id === taskId && item.status === "pool" ? { ...item, status: "committed", updatedAt: timestamp } : item),
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp
  };
};
var startTaskInTeamState = (state, taskId, timestamp) => startWorkSessionInState(state, taskId, timestamp, { source: "cli", idFactory: uid });
var pauseWorkSessionInTeamState = (state, input, timestamp) => pauseWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "cli", idFactory: uid });
var resumeWorkSessionInTeamState = (state, input, timestamp) => resumeWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { source: "cli", idFactory: uid });
var finishWorkSessionInTeamState = (state, input, timestamp) => finishWorkSessionInState(state, timestamp, input.taskId, input.workSessionId, { outcome: input.outcome, source: "cli", idFactory: uid });

// mcp-server/src/businessReviewSettingsOperations.ts
var submitTaskReviewInTeamState = (state, taskId, timestamp) => {
  const task = requireTask(state, taskId);
  return submitTaskForReviewInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var acceptTaskReviewInTeamState = (state, taskId, timestamp) => {
  const task = requireTask(state, taskId);
  return acceptTaskInState(state, taskId, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var returnTaskReviewInTeamState = (state, taskId, reason, timestamp) => {
  const task = requireTask(state, taskId);
  return returnTaskForReviewInState(state, taskId, reason, resolveMemberIdForProject(state, task.projectId), timestamp);
};
var recordInterruptionInTeamState = (state, input, timestamp) => {
  const session = input.workSessionId ? state.workSessions.find((item) => item.id === input.workSessionId) : void 0;
  const taskId = input.taskId ?? session?.taskId;
  const task = taskId ? state.tasks.find((item) => item.id === taskId) : void 0;
  return {
    ...state,
    interruptions: [
      {
        id: uid("interruption"),
        workspaceId: task ? workspaceIdForTask(state, task) : state.auth.workspace?.id,
        sessionId: input.workSessionId,
        taskId,
        type: input.type,
        note: input.note?.trim() ?? "",
        action: input.action ?? "defer",
        createdAt: timestamp
      },
      ...state.interruptions
    ],
    updatedAt: timestamp
  };
};
var updateDailyReviewInTeamState = (state, input, timestamp) => {
  const date = input.date ?? today();
  const workspaceId = input.workspaceId ?? currentDailyPlanWorkspaceId(state);
  const existing = currentAccountDailyPlanForWorkspaceDate(state, workspaceId, date);
  const plan = existing ?? createDailyPlanForDate(state, date, timestamp, workspaceId);
  const nextPlan = {
    ...plan,
    reflection: input.reflection ?? plan.reflection,
    capacityPomodoros: input.capacityPomodoros === void 0 ? plan.capacityPomodoros : Math.max(1, Math.round(input.capacityPomodoros)),
    review: {
      ...plan.review,
      mood: input.mood ?? plan.review.mood,
      wins: input.wins ?? plan.review.wins,
      blockers: input.blockers ?? plan.review.blockers,
      interruptionPattern: input.interruptionPattern ?? plan.review.interruptionPattern,
      tomorrowFocus: input.tomorrowFocus ?? plan.review.tomorrowFocus
    },
    reviewedAt: timestamp,
    updatedAt: timestamp
  };
  return {
    ...state,
    dailyPlans: existing ? state.dailyPlans.map((item) => item.id === nextPlan.id ? nextPlan : item) : [nextPlan, ...state.dailyPlans],
    updatedAt: timestamp
  };
};
var updateSettingsInTeamState = (state, input, timestamp) => ({
  ...state,
  settings: {
    ...state.settings,
    ...input,
    focusMinutes: input.focusMinutes === void 0 ? state.settings.focusMinutes : Math.max(1, Math.round(input.focusMinutes)),
    shortBreakMinutes: input.shortBreakMinutes === void 0 ? state.settings.shortBreakMinutes : Math.max(1, Math.round(input.shortBreakMinutes)),
    longBreakMinutes: input.longBreakMinutes === void 0 ? state.settings.longBreakMinutes : Math.max(1, Math.round(input.longBreakMinutes)),
    longBreakEvery: input.longBreakEvery === void 0 ? state.settings.longBreakEvery : Math.max(1, Math.round(input.longBreakEvery)),
    whiteNoiseVolume: input.whiteNoiseVolume === void 0 ? state.settings.whiteNoiseVolume : Math.min(100, Math.max(0, Math.round(input.whiteNoiseVolume)))
  },
  updatedAt: timestamp
});
var saveTaskTemplateInTeamState = (state, input, timestamp) => {
  const template = {
    id: input.id?.trim() || uid("template"),
    name: input.name.trim(),
    description: input.description?.trim() ?? "",
    project: input.project?.trim() ?? "",
    tags: input.tags ?? [],
    priority: input.priority,
    severity: input.severity,
    stage: input.stage,
    estimatePomodoros: Math.max(1, Math.round(input.estimatePomodoros)),
    subtasks: input.subtasks ?? [],
    repeatRule: input.repeatRule
  };
  return {
    ...state,
    taskTemplates: state.taskTemplates.some((item) => item.id === template.id) ? state.taskTemplates.map((item) => item.id === template.id ? template : item) : [template, ...state.taskTemplates],
    updatedAt: timestamp
  };
};
var deleteTaskTemplateInTeamState = (state, templateId, timestamp) => ({
  ...state,
  taskTemplates: state.taskTemplates.filter((item) => item.id !== templateId),
  templateInstances: state.templateInstances.filter((item) => item.templateId !== templateId),
  updatedAt: timestamp
});
var instantiateTaskTemplateInTeamState = (state, templateId, projectId, timestamp) => {
  const template = state.taskTemplates.find((item) => item.id === templateId);
  if (!template) throw new Error(`Task template not found: ${templateId}`);
  const beforeTaskIds = new Set(state.tasks.map((task2) => task2.id));
  const next = createProjectTaskInState(state, projectId, {
    title: template.name,
    notes: template.description,
    tags: template.tags,
    priority: template.priority,
    severity: template.severity,
    stage: template.stage,
    estimatePomodoros: template.estimatePomodoros,
    repeatRule: template.repeatRule,
    subtasks: template.subtasks
  }, timestamp, uid);
  const task = next.tasks.find((item) => !beforeTaskIds.has(item.id));
  if (!task) throw new Error("Task template was not instantiated.");
  return {
    ...next,
    templateInstances: [{ templateId, taskId: task.id, createdAt: timestamp }, ...next.templateInstances],
    updatedAt: timestamp
  };
};

// mcp-server/src/businessProjectMemberOperations.ts
var createProjectInTeamState = (state, input, timestamp) => {
  const next = createProjectInState(state, input.name, input.description ?? "", timestamp, uid, {
    accountId: state.auth.account?.id,
    name: state.auth.account?.name,
    email: state.auth.account?.email,
    workspaceId: input.workspaceId,
    taskStageMode: input.taskStageMode
  });
  const created = next.projects.find((project2) => !state.projects.some((item) => item.id === project2.id));
  if (!created) throw new Error("Project was not created.");
  const project = {
    ...created,
    defaultExpectedStartHours: input.defaultExpectedStartHours === void 0 ? created.defaultExpectedStartHours : Math.max(0, Math.round(input.defaultExpectedStartHours))
  };
  return updateProjectInState(next, project, timestamp);
};
var updateProjectInTeamState = (state, projectId, input, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, {
    ...project,
    name: input.name?.trim() || project.name,
    description: input.description ?? project.description,
    defaultExpectedStartHours: input.defaultExpectedStartHours === void 0 ? project.defaultExpectedStartHours : Math.max(0, Math.round(input.defaultExpectedStartHours)),
    taskStageMode: input.taskStageMode ?? project.taskStageMode
  }, timestamp);
};
var archiveProjectInTeamState = (state, projectId, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: timestamp }, timestamp);
};
var restoreProjectInTeamState = (state, projectId, timestamp) => {
  const project = requireProject(state, projectId);
  return updateProjectInState(state, { ...project, archivedAt: void 0 }, timestamp);
};
var createProjectMemberInTeamState = (state, input, timestamp) => {
  const project = requireProject(state, input.projectId);
  return addProjectMemberToState(
    state,
    project.id,
    input.name,
    input.email ?? "",
    input.roles ?? ["executor"],
    timestamp,
    uid,
    { accountId: input.accountId, workspaceId: project.workspaceId }
  );
};
var updateProjectMemberInTeamState = (state, projectMemberId, input, timestamp) => {
  const member = requireMember(state, projectMemberId);
  return updateProjectMemberInState(state, {
    ...member,
    name: input.name?.trim() || member.name,
    email: input.email === void 0 ? member.email : input.email.trim() || void 0,
    roles: input.roles ?? member.roles,
    status: input.status ?? member.status ?? "active"
  }, timestamp);
};
var bindMemberToProjectInTeamState = (state, projectId, memberRef, roles, timestamp) => {
  const project = requireProject(state, projectId);
  const normalized = memberRef.trim().toLowerCase();
  const source = state.projectMembers.find(
    (member) => member.id === memberRef || member.accountId === memberRef || member.email?.trim().toLowerCase() === normalized
  );
  if (!source) throw new Error(`Project member source not found: ${memberRef}`);
  return addProjectMemberToState(state, project.id, source.name, source.email ?? "", roles.length ? roles : ["executor"], timestamp, uid, {
    accountId: source.accountId,
    workspaceId: project.workspaceId ?? source.workspaceId
  });
};
var unbindProjectMemberInTeamState = (state, projectMemberId, timestamp) => updateProjectMemberInTeamState(state, projectMemberId, { status: "disabled" }, timestamp);

// src/authModel.ts
var bindAccountToMembers = (value, auth, timestamp = (/* @__PURE__ */ new Date()).toISOString()) => {
  const account = auth.account;
  if (!account) return value;
  const hasAccountOwnerForProject = (projectId) => value.projectMembers.some((member) => member.projectId === projectId && member.accountId === account.id && member.roles.includes("project_owner"));
  const memberHasIdentity = (member) => {
    return Boolean(member.accountId || member.email);
  };
  const projectHasIdentifiedMember = (projectId) => value.projectMembers.some((member) => member.projectId === projectId && memberHasIdentity(member));
  const accountEmail = account.email.toLowerCase();
  const shouldBindProjectMember = (member) => {
    if (member.accountId === account.id) return true;
    if (member.accountId) return false;
    if (member.email?.toLowerCase() === accountEmail) return true;
    return member.roles.includes("project_owner") && !hasAccountOwnerForProject(member.projectId) && !projectHasIdentifiedMember(member.projectId) && !member.email;
  };
  const projectMembers = value.projectMembers.map(
    (member) => shouldBindProjectMember(member) ? {
      ...member,
      accountId: account.id,
      name: member.name || account.name,
      email: member.email ?? account.email,
      status: member.status ?? "active",
      updatedAt: timestamp
    } : { ...member, status: member.status ?? "active" }
  );
  return {
    ...value,
    auth,
    projectMembers,
    backend: {
      ...value.backend,
      token: auth.token,
      username: account.email,
      message: auth.message,
      status: "idle"
    },
    updatedAt: timestamp
  };
};

// src/teamBackendHttp.ts
var apiUrl = (serverUrl, path) => `${serverUrl.replace(/\/+$/, "")}${path}`;
var authHeaders = (token) => ({
  "Content-Type": "application/json",
  ...token ? { Authorization: `Bearer ${token}` } : {}
});
var readResponse = async (response) => {
  if (response.ok) return response.json();
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = await response.json();
    if (body.error) message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};
var requestJson = async (input, init) => {
  try {
    const response = await fetch(input, init);
    return readResponse(response);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("\u65E0\u6CD5\u8FDE\u63A5\u56E2\u961F\u540E\u53F0\uFF0C\u8BF7\u68C0\u67E5\u670D\u52A1\u5730\u5740\u662F\u5426\u6B63\u786E\uFF0C\u5E76\u786E\u8BA4\u540E\u53F0\u670D\u52A1\u5DF2\u542F\u52A8");
    }
    throw error;
  }
};

// src/teamBackendMappers.ts
var mapAccount = (account) => ({
  id: account.id,
  workspaceId: account.workspace_id,
  name: account.name,
  email: account.email,
  disabledAt: account.disabled_at || void 0,
  createdAt: account.created_at,
  updatedAt: account.updated_at
});
var mapWorkspace = (workspace) => ({
  id: workspace.id,
  name: workspace.name,
  type: workspace.type === "private" ? "private" : "shared",
  ownerAccountId: workspace.owner_account_id || void 0,
  createdAt: workspace.created_at,
  updatedAt: workspace.updated_at
});
var mapWorkspaceMembership = (membership) => ({
  id: membership.id,
  workspaceId: membership.workspace_id,
  accountId: membership.account_id,
  name: membership.name,
  email: membership.email,
  role: membership.role,
  status: membership.status,
  createdAt: membership.created_at,
  updatedAt: membership.updated_at
});
var mapWorkspaceInvitation = (invitation) => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  workspaceType: invitation.workspace_type === "private" ? "private" : "shared",
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || void 0
});
var mapProjectInvitation = (invitation) => ({
  id: invitation.id,
  workspaceId: invitation.workspace_id,
  workspaceName: invitation.workspace_name,
  projectId: invitation.project_id,
  projectName: invitation.project_name,
  inviterAccountId: invitation.inviter_account_id,
  inviterName: invitation.inviter_name,
  inviterEmail: invitation.inviter_email,
  inviteeAccountId: invitation.invitee_account_id,
  inviteeEmail: invitation.invitee_email,
  roles: invitation.roles?.length ? invitation.roles : ["executor"],
  status: invitation.status,
  createdAt: invitation.created_at,
  updatedAt: invitation.updated_at,
  acceptedAt: invitation.accepted_at || void 0
});
var sessionFromLogin = (payload) => ({
  token: payload.token,
  expiresAt: payload.expires_at,
  account: mapAccount(payload.account),
  workspace: mapWorkspace(payload.workspace),
  membership: payload.membership ? mapWorkspaceMembership(payload.membership) : void 0,
  workspaces: (payload.workspaces ?? [payload.workspace]).map(mapWorkspace)
});

// src/teamBackendAuthApi.ts
async function getAuthStatus(serverUrl) {
  return requestJson(apiUrl(serverUrl, "/auth/status"));
}
async function loginToWorkspace(backend, email, password) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/auth/login"), {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({
      email: email.trim(),
      password,
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}
async function switchWorkspace(backend, token, workspaceId) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/auth/switch-workspace"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}

// src/teamBackendWorkspaceApi.ts
async function createWorkspace(backend, token, name) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspaces"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name,
      type: "shared",
      device_id: backend.deviceId
    })
  });
  return sessionFromLogin(payload);
}
async function fetchWorkspaces(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspaces"), {
    headers: authHeaders(token)
  });
  return {
    workspaces: payload.workspaces.map(mapWorkspace),
    memberships: (payload.memberships ?? []).map(mapWorkspaceMembership)
  };
}
async function updateWorkspace(backend, token, workspaceId, input) {
  const payload = await requestJson(apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: input.name,
      type: input.type ?? "shared",
      owner_account_id: input.ownerAccountId
    })
  });
  return mapWorkspace(payload.workspace);
}
async function updateWorkspaceMembership(backend, token, workspaceId, membershipId, input) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspaces/${encodeURIComponent(workspaceId)}/members/${encodeURIComponent(membershipId)}`),
    {
      method: "PATCH",
      headers: authHeaders(token),
      body: JSON.stringify({
        status: input.status,
        role: input.role
      })
    }
  );
  return mapWorkspaceMembership(payload.membership);
}

// src/teamBackendInvitationApi.ts
async function fetchWorkspaceInvitations(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    headers: authHeaders(token)
  });
  return payload.invitations.map(mapWorkspaceInvitation);
}
async function inviteWorkspaceMember(backend, token, workspaceId, email) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/workspace-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: workspaceId,
      email
    })
  });
  return mapWorkspaceInvitation(payload.invitation);
}
async function acceptWorkspaceInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token)
    }
  );
  return mapWorkspaceInvitation(payload.invitation);
}
async function deleteWorkspaceInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/workspace-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );
  return mapWorkspaceInvitation(payload.invitation);
}
async function fetchProjectInvitations(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/project-invitations"), {
    headers: authHeaders(token)
  });
  return payload.invitations.map(mapProjectInvitation);
}
async function inviteProjectMember(backend, token, input) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/project-invitations"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      workspace_id: input.workspaceId,
      project_id: input.projectId,
      email: input.email,
      roles: input.roles.length ? input.roles : ["executor"]
    })
  });
  return mapProjectInvitation(payload.invitation);
}
async function deleteProjectInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}`),
    {
      method: "DELETE",
      headers: authHeaders(token)
    }
  );
  return mapProjectInvitation(payload.invitation);
}
async function acceptProjectInvitation(backend, token, invitationId) {
  const payload = await requestJson(
    apiUrl(backend.serverUrl, `/project-invitations/${encodeURIComponent(invitationId)}/accept`),
    {
      method: "POST",
      headers: authHeaders(token)
    }
  );
  return mapProjectInvitation(payload.invitation);
}

// src/teamBackendAdminApi.ts
async function fetchPlatformAccounts(backend, token) {
  const payload = await requestJson(apiUrl(backend.serverUrl, "/admin/accounts"), {
    headers: authHeaders(token)
  });
  return payload.accounts.map(mapAccount);
}
async function createPlatformAccount(backend, token, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, "/admin/accounts"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status
    })
  });
  return mapAccount(result.account);
}
async function updatePlatformAccount(backend, token, accountId, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, `/admin/accounts/${encodeURIComponent(accountId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      email: payload.email,
      password: payload.password,
      status: payload.status
    })
  });
  return mapAccount(result.account);
}
async function createMemberAccount(backend, token, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, "/members"), {
    method: "POST",
    headers: authHeaders(token),
    body: JSON.stringify({
      project_id: payload.projectId,
      workspace_id: payload.workspaceId,
      name: payload.name,
      email: payload.email,
      password: payload.password,
      roles: payload.roles
    })
  });
  return result.member.payload;
}
async function updateMemberAccount(backend, token, memberId, payload) {
  const result = await requestJson(apiUrl(backend.serverUrl, `/members/${encodeURIComponent(memberId)}`), {
    method: "PATCH",
    headers: authHeaders(token),
    body: JSON.stringify({
      name: payload.name,
      workspace_id: payload.workspaceId,
      email: payload.email,
      password: payload.password,
      roles: payload.roles
    })
  });
  return result.member.payload;
}

// src/projectMemberDeduplication.ts
var projectMemberIdentityScope = (member) => `${member.workspaceId ?? ""}:${member.projectId}`;
var compareProjectMemberFreshness = (left, right) => (left.updatedAt ?? "").localeCompare(right.updatedAt ?? "");
var dedupeProjectMembersByIdentity = (members) => {
  const canonicalByIdentity = /* @__PURE__ */ new Map();
  const aliasToIdentity = /* @__PURE__ */ new Map();
  for (const member of members) {
    const scope = projectMemberIdentityScope(member);
    const identity = memberIdentityForProjectMember(member);
    const aliases = memberAccessIdentityAliases(identity).map((alias) => `${scope}:${alias}`);
    const existingIdentity = aliases.map((alias) => aliasToIdentity.get(alias)).find((key) => Boolean(key && canonicalByIdentity.has(key)));
    const identityKey = existingIdentity ?? `${scope}:${memberAccessIdentityKey(identity)}`;
    aliases.forEach((alias) => aliasToIdentity.set(alias, identityKey));
    const current = canonicalByIdentity.get(identityKey);
    if (!current || compareProjectMemberFreshness(member, current) > 0) {
      canonicalByIdentity.set(identityKey, member);
    }
  }
  const canonicalIds = new Set(Array.from(canonicalByIdentity.values()).map((member) => member.id));
  return members.filter((member) => canonicalIds.has(member.id));
};

// src/businessStateWorkspace.ts
var isObject = (value) => typeof value === "object" && value !== null && !Array.isArray(value);
function buildTeamDataWorkspace(state) {
  const currentWorkspaceId = state.auth.workspace?.id;
  const projectWorkspaceIds = new Map(state.projects.map((project) => [project.id, project.workspaceId ?? currentWorkspaceId]));
  const taskWorkspaceIds = new Map(
    state.tasks.map((task) => [task.id, task.workspaceId ?? projectWorkspaceIds.get(task.projectId) ?? currentWorkspaceId])
  );
  const workspaceIdForPayload = (payload, fallback) => {
    if (isObject(payload) && typeof payload.workspaceId === "string" && payload.workspaceId.trim()) {
      return payload.workspaceId;
    }
    return fallback;
  };
  return {
    currentWorkspaceId,
    projectWorkspaceId: (projectId) => projectWorkspaceIds.get(projectId),
    taskWorkspaceId: (taskId) => taskWorkspaceIds.get(taskId),
    workspaceIdForPayload
  };
}

// src/teamBusinessRows.ts
var templateInstanceId = (instance) => `${instance.templateId}_${instance.taskId}`;
var rewardStateId = (state) => `reward_state_${state.auth.account?.id ?? "local"}`;
function businessRowsFromState(state) {
  const workspace = buildTeamDataWorkspace(state);
  const currentWorkspaceId = workspace.currentWorkspaceId;
  const ownerAccountId = state.auth.account?.id;
  return [
    ...state.projects.map((project) => ({
      workspace_id: workspace.workspaceIdForPayload(project, currentWorkspaceId),
      entity: "project",
      id: project.id,
      updated_at: project.updatedAt,
      payload: project
    })),
    ...state.projectMembers.map((member) => ({
      workspace_id: workspace.workspaceIdForPayload(member, workspace.projectWorkspaceId(member.projectId) ?? currentWorkspaceId),
      entity: "project_member",
      id: member.id,
      updated_at: member.updatedAt,
      payload: member
    })),
    ...state.tasks.map((task) => {
      const workspaceId = workspace.projectWorkspaceId(task.projectId) ?? workspace.workspaceIdForPayload(task, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        entity: "task",
        id: task.id,
        updated_at: task.updatedAt,
        payload: workspaceId && task.workspaceId !== workspaceId ? { ...task, workspaceId } : task
      };
    }),
    ...state.dailyPlans.map((plan) => {
      const workspaceId = workspace.workspaceIdForPayload(plan, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        account_id: plan.ownerAccountId ?? ownerAccountId,
        entity: "daily_plan",
        id: plan.id,
        updated_at: plan.updatedAt,
        payload: workspaceId && plan.workspaceId !== workspaceId ? { ...plan, workspaceId } : plan
      };
    }),
    ...state.focusSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(
        session,
        session.taskId ? workspace.taskWorkspaceId(session.taskId) : currentWorkspaceId
      ),
      entity: "focus_session",
      id: session.id,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session
    })),
    ...state.workSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(session, workspace.taskWorkspaceId(session.taskId) ?? currentWorkspaceId),
      entity: "work_session",
      id: session.id,
      updated_at: session.updatedAt,
      payload: session
    })),
    ...state.executionSignals.map((signal) => ({
      workspace_id: workspace.workspaceIdForPayload(signal, workspace.taskWorkspaceId(signal.taskId) ?? currentWorkspaceId),
      entity: "execution_signal",
      id: signal.id,
      updated_at: signal.createdAt,
      payload: signal
    })),
    ...state.interruptions.map((interruption) => ({
      workspace_id: workspace.workspaceIdForPayload(
        interruption,
        interruption.taskId ? workspace.taskWorkspaceId(interruption.taskId) : currentWorkspaceId
      ),
      entity: "interruption",
      id: interruption.id,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption
    })),
    {
      workspace_id: currentWorkspaceId,
      account_id: ownerAccountId,
      entity: "reward_state",
      id: rewardStateId(state),
      updated_at: state.updatedAt,
      payload: state.rewardState
    },
    ...state.taskTemplates.map((template) => ({
      workspace_id: currentWorkspaceId,
      entity: "task_template",
      id: template.id,
      updated_at: state.updatedAt,
      payload: template
    })),
    ...state.templateInstances.map((instance) => ({
      workspace_id: currentWorkspaceId,
      entity: "template_instance",
      id: templateInstanceId(instance),
      updated_at: instance.createdAt,
      payload: instance
    }))
  ];
}
function mergeBusinessRowsIntoState(local, rows) {
  const loadedAt = (/* @__PURE__ */ new Date()).toISOString();
  const base = createInitialState();
  const next = {
    ...base,
    auth: local.auth,
    settings: local.settings,
    backend: {
      ...local.backend,
      status: "ready",
      message: "\u56E2\u961F\u5728\u7EBF\u6570\u636E\u5DF2\u52A0\u8F7D",
      lastLoadedAt: loadedAt
    },
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    focusSessions: [],
    workSessions: [],
    executionSignals: [],
    interruptions: [],
    taskTemplates: [],
    templateInstances: [],
    rewardState: local.rewardState,
    updatedAt: loadedAt
  };
  for (const row of rows) {
    if (row.entity === "project") next.projects.push(row.payload);
    if (row.entity === "project_member") next.projectMembers.push(row.payload);
    if (row.entity === "task") next.tasks.push(row.payload);
    if (row.entity === "daily_plan") next.dailyPlans.push(row.payload);
    if (row.entity === "focus_session") next.focusSessions.push(row.payload);
    if (row.entity === "work_session") next.workSessions.push(row.payload);
    if (row.entity === "execution_signal") next.executionSignals.push(row.payload);
    if (row.entity === "interruption") next.interruptions.push(row.payload);
    if (row.entity === "task_template") next.taskTemplates.push(row.payload);
    if (row.entity === "template_instance") next.templateInstances.push(row.payload);
    if (row.entity === "reward_state" && (!row.account_id || row.account_id === local.auth.account?.id)) {
      next.rewardState = row.payload;
    }
  }
  return {
    ...next,
    projectMembers: dedupeProjectMembersByIdentity(next.projectMembers)
  };
}

// src/teamActiveRuntimePreservation.ts
var upsertById = (items, incoming) => items.some((item) => item.id === incoming.id) ? items.map((item) => item.id === incoming.id ? incoming : item) : [incoming, ...items];
var localIsNewerOrMissing = (local, remote) => !remote || (local.updatedAt ?? local.startedAt ?? "") >= (remote.updatedAt ?? remote.startedAt ?? "");
var preserveLocalActiveRuntime = (remote, local) => {
  const active = local.activeTimer;
  if (!active) return remote;
  let next = { ...remote, activeTimer: active };
  const localTask = active.taskId ? local.tasks.find((task) => task.id === active.taskId) : void 0;
  if (localTask && localIsNewerOrMissing(localTask, next.tasks.find((task) => task.id === localTask.id))) {
    next = { ...next, tasks: upsertById(next.tasks, localTask) };
  }
  const localFocusSession = local.focusSessions.find((session) => session.id === active.sessionId);
  if (localFocusSession && localIsNewerOrMissing(localFocusSession, next.focusSessions.find((session) => session.id === localFocusSession.id))) {
    next = { ...next, focusSessions: upsertById(next.focusSessions, localFocusSession) };
  }
  const localWorkSession = local.workSessions.find(
    (session) => active.workSessionId ? session.id === active.workSessionId : session.focusSessionId === active.sessionId
  );
  if (localWorkSession && (localWorkSession.status === "active" || localWorkSession.status === "paused") && localIsNewerOrMissing(localWorkSession, next.workSessions.find((session) => session.id === localWorkSession.id))) {
    next = { ...next, workSessions: upsertById(next.workSessions, localWorkSession) };
  }
  const localSignals = localWorkSession ? local.executionSignals.filter((signal) => signal.workSessionId === localWorkSession.id) : [];
  if (localSignals.length) {
    const existingSignalIds = new Set(next.executionSignals.map((signal) => signal.id));
    const missingSignals = localSignals.filter((signal) => !existingSignalIds.has(signal.id));
    if (missingSignals.length) {
      next = { ...next, executionSignals: [...missingSignals, ...next.executionSignals] };
    }
  }
  return ensureTodayPlan(next);
};

// src/teamBusinessApi.ts
async function loadTeamData(local) {
  const token = local.auth.token ?? local.backend.token;
  if (!token) return local;
  const payload = await requestJson(apiUrl(local.backend.serverUrl, "/team/data"), {
    headers: authHeaders(token)
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState(local, payload.rows), local);
}
async function saveTeamDataSnapshot(backend, token, state) {
  const savedAt = (/* @__PURE__ */ new Date()).toISOString();
  const payload = await requestJson(apiUrl(backend.serverUrl, "/team/data"), {
    method: "PUT",
    headers: authHeaders(token),
    body: JSON.stringify({ rows: businessRowsFromState(state) })
  });
  return preserveLocalActiveRuntime(mergeBusinessRowsIntoState({
    ...state,
    backend: {
      ...state.backend,
      lastSavedAt: savedAt
    }
  }, payload.rows), state);
}

// mcp-server/src/clientBase.ts
var TimeManageMcpBaseClient = class {
  constructor(config) {
    this.config = config;
  }
  session;
  backendState(session) {
    const state = createInitialState();
    return {
      ...state,
      auth: session ? {
        status: "authenticated",
        token: session.token,
        expiresAt: session.expiresAt,
        account: session.account,
        workspace: session.workspace,
        membership: session.membership,
        workspaces: session.workspaces,
        workspaceMemberships: [],
        bootstrapped: true,
        message: "CLI \u5DF2\u767B\u5F55\u56E2\u961F\u540E\u53F0"
      } : state.auth,
      backend: {
        ...state.backend,
        serverUrl: this.config.serverUrl,
        username: session?.account.email ?? this.config.email,
        deviceId: this.config.deviceId,
        token: session?.token,
        status: session ? "ready" : "idle",
        message: session ? "CLI \u5DF2\u8FDE\u63A5\u56E2\u961F\u540E\u53F0" : "CLI \u5C1A\u672A\u767B\u5F55\u56E2\u961F\u540E\u53F0"
      }
    };
  }
  async ensureSession() {
    if (this.session && new Date(this.session.expiresAt).getTime() > Date.now() + 6e4) return this.session;
    this.session = await loginToWorkspace(this.backendState().backend, this.config.email, this.config.password);
    return this.session;
  }
  async authenticatedState() {
    const session = await this.ensureSession();
    const base = this.backendState(session);
    const workspaces = await fetchWorkspaces(base.backend, session.token);
    const auth = {
      ...base.auth,
      status: "authenticated",
      token: session.token,
      expiresAt: session.expiresAt,
      account: session.account,
      workspace: session.workspace,
      membership: session.membership,
      workspaces: workspaces.workspaces,
      workspaceMemberships: workspaces.memberships,
      bootstrapped: true,
      message: "CLI \u5DF2\u767B\u5F55\u56E2\u961F\u540E\u53F0"
    };
    const local = bindAccountToMembers({ ...base, auth }, auth);
    return bindAccountToMembers(await loadTeamData(local), auth);
  }
  async writeState(nextState) {
    const session = await this.ensureSession();
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const stateToSave = {
      ...nextState,
      auth: {
        ...nextState.auth,
        status: "authenticated",
        token: session.token,
        expiresAt: session.expiresAt,
        account: session.account,
        workspace: session.workspace,
        membership: session.membership
      },
      backend: {
        ...nextState.backend,
        serverUrl: this.config.serverUrl,
        username: session.account.email,
        deviceId: this.config.deviceId,
        token: session.token,
        lastSavedAt: timestamp,
        status: "ready",
        message: "CLI \u5DF2\u5199\u5165\u56E2\u961F\u540E\u53F0"
      },
      updatedAt: timestamp
    };
    return saveTeamDataSnapshot(stateToSave.backend, session.token, stateToSave);
  }
  async mutate(_preferredProjectId, fn) {
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const before = await this.authenticatedState();
    const output = fn(before, timestamp);
    const saved = await this.writeState(output.state);
    return { state: saved, result: output.result, savedAt: saved.backend.lastSavedAt };
  }
  async backendAndToken() {
    const session = await this.ensureSession();
    return { backend: this.backendState(session).backend, token: session.token, session };
  }
  setSession(session) {
    this.session = session;
  }
  async health() {
    const status = await getAuthStatus(this.config.serverUrl);
    return {
      ok: true,
      serverUrl: this.config.serverUrl,
      bootstrapped: status.bootstrapped,
      workspaceId: status.workspace_id,
      workspaceName: status.workspace_name
    };
  }
  async getBackendDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.authenticatedState();
    return {
      serverUrl: this.config.serverUrl,
      deviceId: this.config.deviceId,
      account: {
        id: session.account.id,
        email: session.account.email,
        name: session.account.name
      },
      workspace: state.auth.workspace,
      counts: {
        workspaces: state.auth.workspaces?.length ?? 0,
        workspaceMemberships: state.auth.workspaceMemberships?.length ?? 0,
        projects: state.projects.length,
        projectMembers: state.projectMembers.length,
        tasks: state.tasks.length,
        dailyPlans: state.dailyPlans.length,
        workSessions: state.workSessions.length,
        executionSignals: state.executionSignals.length,
        interruptions: state.interruptions.length,
        taskTemplates: state.taskTemplates.length
      },
      backend: {
        lastLoadedAt: state.backend.lastLoadedAt,
        lastSavedAt: state.backend.lastSavedAt,
        status: state.backend.status,
        message: state.backend.message
      }
    };
  }
  async getCurrentAccount() {
    const state = await this.authenticatedState();
    return {
      account: state.auth.account,
      workspace: state.auth.workspace,
      membership: state.auth.membership
    };
  }
  async listWorkspaces() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaces(backend, token);
  }
  async switchWorkspace(workspaceId) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await switchWorkspace(backend, token, workspaceId));
    return this.getCurrentAccount();
  }
  async createWorkspace(name) {
    const { backend, token } = await this.backendAndToken();
    this.setSession(await createWorkspace(backend, token, name));
    return this.getCurrentAccount();
  }
  async updateWorkspace(workspaceId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspace(backend, token, workspaceId, input);
  }
  async updateWorkspaceMembership(workspaceId, membershipId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateWorkspaceMembership(backend, token, workspaceId, membershipId, input);
  }
  async listPlatformAccounts() {
    const { backend, token } = await this.backendAndToken();
    return fetchPlatformAccounts(backend, token);
  }
  async createPlatformAccount(input) {
    const { backend, token } = await this.backendAndToken();
    return createPlatformAccount(backend, token, input);
  }
  async updatePlatformAccount(accountId, input) {
    const { backend, token } = await this.backendAndToken();
    return updatePlatformAccount(backend, token, accountId, input);
  }
  async disablePlatformAccount(accountId) {
    return this.updatePlatformAccount(accountId, { status: "disabled" });
  }
  async updatePlatformAccountPassword(accountId, password) {
    return this.updatePlatformAccount(accountId, { password });
  }
  async listWorkspaceInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchWorkspaceInvitations(backend, token);
  }
  async inviteWorkspaceMember(workspaceId, email) {
    const { backend, token } = await this.backendAndToken();
    return inviteWorkspaceMember(backend, token, workspaceId, email);
  }
  async acceptWorkspaceInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return acceptWorkspaceInvitation(backend, token, invitationId);
  }
  async deleteWorkspaceInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return deleteWorkspaceInvitation(backend, token, invitationId);
  }
  async listProjectInvitations() {
    const { backend, token } = await this.backendAndToken();
    return fetchProjectInvitations(backend, token);
  }
  async inviteProjectMember(input) {
    const { backend, token } = await this.backendAndToken();
    return inviteProjectMember(backend, token, input);
  }
  async acceptProjectInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return acceptProjectInvitation(backend, token, invitationId);
  }
  async deleteProjectInvitation(invitationId) {
    const { backend, token } = await this.backendAndToken();
    return deleteProjectInvitation(backend, token, invitationId);
  }
  async createMemberAccount(input) {
    const { backend, token } = await this.backendAndToken();
    return createMemberAccount(backend, token, input);
  }
  async updateMemberAccount(memberId, input) {
    const { backend, token } = await this.backendAndToken();
    return updateMemberAccount(backend, token, memberId, input);
  }
};

// mcp-server/src/toolResult.ts
var requireConfirmation = (confirmed, action) => {
  if (!confirmed) {
    throw new Error(`${action} requires explicit user confirmation. Ask the user to confirm, then call again with confirmed=true.`);
  }
};

// src/memberStatusPeople.ts
var normalizedEmail4 = (email) => email?.trim().toLowerCase();
var memberStatusIdentityKeys = (identity) => [
  identity.accountId ? `account:${identity.accountId}` : "",
  normalizedEmail4(identity.email) ? `email:${normalizedEmail4(identity.email)}` : "",
  identity.id ? `member:${identity.id}` : ""
].filter(Boolean);
var mergeIdentityKeys = (left, right) => Array.from(/* @__PURE__ */ new Set([...left, ...right]));
var findMemberStatusPerson = (people, keys) => people.find((person) => keys.some((key) => person.identityKeys.includes(key)));
var buildMemberStatusPeople = (projectMembers, workspaceMemberships = []) => {
  const people = [];
  workspaceMemberships.filter((membership) => membership.status === "active").reduce((drafts, membership) => {
    const identityKeys = memberStatusIdentityKeys(membership);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: membership.accountId,
        name: membership.name,
        roles: [],
        accountId: membership.accountId,
        email: membership.email,
        memberIds: [],
        projectIds: [],
        workspaceIds: [membership.workspaceId],
        members: [],
        workspaceMemberships: [membership],
        identityKeys
      });
      return drafts;
    }
    existing.name = existing.name || membership.name;
    existing.accountId = existing.accountId ?? membership.accountId;
    existing.email = existing.email ?? membership.email;
    existing.workspaceIds = Array.from(/* @__PURE__ */ new Set([...existing.workspaceIds, membership.workspaceId]));
    existing.workspaceMemberships = [...existing.workspaceMemberships, membership];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);
  projectMembers.reduce((drafts, member) => {
    const identityKeys = memberStatusIdentityKeys(member);
    const existing = findMemberStatusPerson(drafts, identityKeys);
    if (!existing) {
      drafts.push({
        id: member.accountId ?? member.email ?? member.id,
        name: member.name,
        roles: member.roles,
        accountId: member.accountId,
        email: member.email,
        memberIds: [member.id],
        projectIds: [member.projectId],
        workspaceIds: [],
        members: [member],
        workspaceMemberships: [],
        identityKeys
      });
      return drafts;
    }
    existing.roles = Array.from(/* @__PURE__ */ new Set([...existing.roles, ...member.roles]));
    existing.accountId = existing.accountId ?? member.accountId;
    existing.email = existing.email ?? member.email;
    existing.memberIds = Array.from(/* @__PURE__ */ new Set([...existing.memberIds, member.id]));
    existing.projectIds = Array.from(/* @__PURE__ */ new Set([...existing.projectIds, member.projectId]));
    existing.members = [...existing.members, member];
    existing.identityKeys = mergeIdentityKeys(existing.identityKeys, identityKeys);
    return drafts;
  }, people);
  return people.map(({ identityKeys: _identityKeys, ...person }) => person);
};

// src/projectTaskDisplay.ts
var projectTaskStatusColumns = [
  { status: "pool", title: "\u4EFB\u52A1\u6C60" },
  { status: "committed", title: "\u5DF2\u5B89\u6392" },
  { status: "in_progress", title: "\u8FDB\u884C\u4E2D" },
  { status: "pending_review", title: "\u5F85\u9A8C\u6536" },
  { status: "completed", title: "\u5DF2\u5B8C\u6210" },
  { status: "split", title: "\u5DF2\u62C6\u5206" },
  { status: "archived", title: "\u5DF2\u5F52\u6863" }
];
var statusTitleByStatus = Object.fromEntries(projectTaskStatusColumns.map((column) => [column.status, column.title]));
var canShowActiveState = (status) => status === "in_progress";
var stageTaskSortRank = (status, isActive, isTodayTask) => {
  if (status === "pending_review") return 0;
  if (isActive && canShowActiveState(status)) return 1;
  if (isTodayTask) return 2;
  return 3;
};

// src/memberStatusTasks.ts
var memberProjectRoleLabel = (members, projectId) => {
  const projectMember = members.find((member) => member.projectId === projectId);
  if (!projectMember) return "\u6210\u5458";
  return projectMember.roles.includes("project_owner") ? "\u9879\u76EE\u8D1F\u8D23\u4EBA" : "\u6267\u884C\u8005";
};
var groupMemberTasksByProject = (member, tasks, projectNameById, workspaceNameByProjectId) => {
  const groups = /* @__PURE__ */ new Map();
  const ensureGroup = (projectId, fallbackName) => {
    const existing = groups.get(projectId);
    if (existing) {
      if (fallbackName && existing.tasks.length === 0) existing.projectName = fallbackName;
      return existing;
    }
    const group = {
      projectId,
      projectName: projectNameById.get(projectId) ?? fallbackName ?? "\u672A\u5F52\u5C5E\u9879\u76EE",
      workspaceName: workspaceNameByProjectId.get(projectId),
      roleLabel: memberProjectRoleLabel(member.members, projectId),
      tasks: []
    };
    groups.set(projectId, group);
    return group;
  };
  member.projectIds.forEach((projectId) => ensureGroup(projectId));
  tasks.forEach((task) => ensureGroup(task.projectId || task.project || "unknown_project", task.project).tasks.push(task));
  return Array.from(groups.values());
};
var taskBelongsToMemberStatusPerson = (task, member, memberIds) => {
  const collaboratorMemberIds = task.collaboratorMemberIds ?? [];
  const isExplicitlyAssigned = Boolean(
    task.primaryExecutorMemberId && memberIds.has(task.primaryExecutorMemberId) || collaboratorMemberIds.some((memberId) => memberIds.has(memberId))
  );
  const isUnassigned = !task.primaryExecutorMemberId && collaboratorMemberIds.length === 0;
  return isExplicitlyAssigned || isUnassigned && member.roles.includes("project_owner") && member.projectIds.includes(task.projectId);
};
var sortMemberStatusTasks = (tasks, runningTask) => [...tasks].sort((left, right) => {
  if (left.id === runningTask?.id) return -1;
  if (right.id === runningTask?.id) return 1;
  const statusDelta = stageTaskSortRank(left.status, false, true) - stageTaskSortRank(right.status, false, true);
  if (statusDelta !== 0) return statusDelta;
  return left.sortOrder - right.sortOrder;
});

// src/memberStatusColumns.ts
var sourceProjectIdsForMemberStatus = (state, projectId) => {
  const accessibleProjectIds = accessibleProjectIdsForCurrentUser(state);
  return projectId ? new Set(accessibleProjectIds.has(projectId) ? [projectId] : []) : accessibleProjectIds;
};
var sourceTasksForMemberStatus = (state, sourceProjectIds) => state.tasks.filter(
  (task) => task.status !== "split" && task.status !== "archived" && sourceProjectIds.has(task.projectId)
);
var todayTaskIdsForMemberStatus = (state, sourceTaskIds, date) => new Set(
  state.dailyPlans.filter((plan) => plan.date === date).flatMap((plan) => plan.committedTaskIds).filter((taskId) => sourceTaskIds.has(taskId))
);
var buildMemberStatusColumns = (state, projectId, date = today()) => {
  const sourceProjectIds = sourceProjectIdsForMemberStatus(state, projectId);
  const accessibleWorkspaceIds = activeWorkspaceIdsForCurrentAccount(state);
  const sourceWorkspaceIds = new Set(
    state.projects.filter((project) => sourceProjectIds.has(project.id)).map((project) => workspaceIdForProject(state, project)).filter((workspaceId) => typeof workspaceId === "string" && accessibleWorkspaceIds.has(workspaceId))
  );
  const sourceProjectMembers = state.projectMembers.filter((member) => sourceProjectIds.has(member.projectId) && member.status !== "disabled");
  const sourceWorkspaceMemberships = workspaceMembershipsForState(state).filter(
    (membership) => sourceWorkspaceIds.has(membership.workspaceId) && membership.status === "active"
  );
  const members = buildMemberStatusPeople(sourceProjectMembers, sourceWorkspaceMemberships);
  const sourceTasks = sourceTasksForMemberStatus(state, sourceProjectIds);
  const sourceTaskIds = new Set(sourceTasks.map((task) => task.id));
  const todayTaskIdSet = todayTaskIdsForMemberStatus(state, sourceTaskIds, date);
  const activeSessions = state.workSessions.filter((session) => session.status === "active" && sourceTasks.some((task) => task.id === session.taskId)).sort((left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime());
  const projectNameById = new Map(state.projects.map((project) => [project.id, project.name]));
  const workspaceNameByProjectId = new Map(
    state.projects.flatMap((project) => {
      const workspaceName2 = workspaceForProject(state, project)?.name;
      return workspaceName2 ? [[project.id, workspaceName2]] : [];
    })
  );
  return members.map((member) => {
    const memberIdSet = new Set(member.memberIds);
    const runningSession = activeSessions.find((session) => session.executorMemberId && memberIdSet.has(session.executorMemberId));
    const runningTask = runningSession ? sourceTasks.find((task) => task.id === runningSession.taskId) : void 0;
    const memberTodayTasks = sortMemberStatusTasks(
      sourceTasks.filter(
        (task) => (todayTaskIdSet.has(task.id) || task.id === runningTask?.id) && taskBelongsToMemberStatusPerson(task, member, memberIdSet)
      ),
      runningTask
    );
    const displayedTasks = runningTask && !memberTodayTasks.some((task) => task.id === runningTask.id) ? [runningTask, ...memberTodayTasks] : memberTodayTasks;
    const projectTaskGroups = groupMemberTasksByProject(member, displayedTasks, projectNameById, workspaceNameByProjectId).filter((group) => group.tasks.length > 0);
    return {
      ...member,
      displayedTasks,
      projectTaskGroups,
      runningTask
    };
  });
};

// mcp-server/src/views.ts
var workspaceName = (state, workspaceId) => workspaceId ? state.auth.workspaces?.find((workspace) => workspace.id === workspaceId)?.name ?? state.auth.workspace?.name : void 0;
var projectForTask = (state, task) => state.projects.find((project) => project.id === task.projectId);
var memberName2 = (state, memberId) => memberId ? state.projectMembers.find((member) => member.id === memberId)?.name : void 0;
var compactProject = (state, project) => ({
  id: project.id,
  workspaceId: project.workspaceId,
  workspaceName: workspaceName(state, project.workspaceId),
  name: project.name,
  description: project.description,
  defaultExpectedStartHours: project.defaultExpectedStartHours,
  taskStageMode: project.taskStageMode,
  archivedAt: project.archivedAt,
  taskCount: state.tasks.filter((task) => task.projectId === project.id && task.status !== "archived" && task.status !== "split").length,
  memberCount: countProjectAccessibleMembers(state, project, project.workspaceId),
  updatedAt: project.updatedAt
});
var compactMember = (state, member) => ({
  id: member.id,
  workspaceId: member.workspaceId,
  workspaceName: workspaceName(state, member.workspaceId),
  projectId: member.projectId,
  projectName: state.projects.find((project) => project.id === member.projectId)?.name,
  accountId: member.accountId,
  name: member.name,
  email: member.email,
  roles: member.roles,
  status: member.status ?? "active",
  updatedAt: member.updatedAt
});
var compactTask = (state, task) => {
  const project = projectForTask(state, task);
  return {
    id: task.id,
    workspaceId: task.workspaceId ?? project?.workspaceId,
    workspaceName: workspaceName(state, task.workspaceId ?? project?.workspaceId),
    title: task.title,
    notes: task.notes,
    tags: task.tags,
    projectId: task.projectId,
    project: task.project,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    primaryExecutorName: memberName2(state, task.primaryExecutorMemberId),
    collaboratorMemberIds: task.collaboratorMemberIds ?? [],
    status: task.status,
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    progressPercent: task.progressPercent ?? 0,
    progressNote: task.progressNote,
    estimatePomodoros: task.estimatePomodoros,
    actualPomodoros: task.actualPomodoros,
    expectedStartAt: task.expectedStartAt,
    expectedFinishAt: task.expectedFinishAt,
    dueAt: task.dueAt,
    reminderAt: task.reminderAt,
    repeatRule: task.repeatRule,
    repeatIntervalDays: task.repeatIntervalDays,
    subtasks: task.subtasks,
    reviewSubmittedAt: task.reviewSubmittedAt,
    reviewAcceptedAt: task.reviewAcceptedAt,
    reviewReturnedAt: task.reviewReturnedAt,
    reviewReturnReason: task.reviewReturnReason,
    completedAt: task.completedAt,
    updatedAt: task.updatedAt
  };
};
var taskMatchesFilter = (task, filter) => {
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if (!filter.includeArchived && task.status === "archived") return false;
  if (!filter.includeSplit && task.status === "split") return false;
  if (filter.status && filter.status !== "all" && task.status !== filter.status) return false;
  if (filter.assigneeMemberId) {
    const collaborators = task.collaboratorMemberIds ?? [];
    if (task.primaryExecutorMemberId !== filter.assigneeMemberId && !collaborators.includes(filter.assigneeMemberId)) return false;
  }
  const query = filter.query?.trim().toLowerCase();
  if (query && !`${task.title} ${task.notes} ${task.project} ${task.tags.join(" ")}`.toLowerCase().includes(query)) return false;
  return true;
};
var listProjectViews = (state) => sortedByUpdatedAt(state.projects.filter((project) => !project.archivedAt)).map((project) => compactProject(state, project));
var listTaskViews = (state, filter = {}) => sortedByUpdatedAt(state.tasks.filter((task) => taskMatchesFilter(task, filter))).map((task) => compactTask(state, task));
var taskDetailView = (state, taskId) => {
  const task = state.tasks.find((item) => item.id === taskId);
  if (!task) throw new Error(`Task not found: ${taskId}`);
  return {
    ...compactTask(state, task),
    projectDetail: state.projects.find((project) => project.id === task.projectId),
    workSessions: state.workSessions.filter((session) => session.taskId === taskId),
    executionSignals: state.executionSignals.filter((signal) => signal.taskId === taskId),
    interruptions: state.interruptions.filter((interruption) => interruption.taskId === taskId)
  };
};
var planTasks = (state, plan) => plan.committedTaskIds.map((taskId) => state.tasks.find((task) => task.id === taskId)).filter((task) => Boolean(task)).map((task) => compactTask(state, task));
var dailyPlanView = (state, date = today()) => {
  const plans = date === today() ? currentAccountDailyPlansForDate(state, date) : currentAccountDailyPlansForDate(state, date);
  const combined = date === today() ? getTodayPlan(state) : plans[0];
  return {
    date,
    combined: combined ? {
      ...combined,
      tasks: planTasks(state, combined)
    } : void 0,
    plans: plans.map((plan) => ({
      ...plan,
      workspaceName: workspaceName(state, plan.workspaceId),
      tasks: planTasks(state, plan)
    }))
  };
};
var todayWorkbenchView = (state, projectId, date = today()) => buildMemberStatusColumns(state, projectId, date).map((member) => ({
  id: member.id,
  name: member.name,
  accountId: member.accountId,
  email: member.email,
  roles: member.roles,
  projectIds: member.projectIds,
  workspaceIds: member.workspaceIds,
  runningTask: member.runningTask ? compactTask(state, member.runningTask) : void 0,
  displayedTasks: member.displayedTasks.map((task) => compactTask(state, task)),
  projectTaskGroups: member.projectTaskGroups.map((group) => ({
    ...group,
    tasks: group.tasks.map((task) => compactTask(state, task))
  }))
}));
var sessionView = (state, session) => ({
  ...session,
  task: state.tasks.find((task) => task.id === session.taskId) ? compactTask(state, state.tasks.find((task) => task.id === session.taskId)) : void 0,
  executorName: memberName2(state, session.executorMemberId)
});
var activeWorkView = (state, projectId) => sortedByUpdatedAt(state.workSessions.filter((session) => {
  if (session.status !== "active" && session.status !== "paused") return false;
  if (!projectId) return true;
  return state.tasks.some((task) => task.id === session.taskId && task.projectId === projectId);
})).map((session) => sessionView(state, session));
var projectOverviewView = (state, projectId) => {
  const project = state.projects.find((item) => item.id === projectId);
  if (!project) throw new Error(`Project not found: ${projectId}`);
  const tasks = state.tasks.filter((task) => task.projectId === projectId);
  const statusCounts = tasks.reduce((acc, task) => {
    acc[task.status] = (acc[task.status] ?? 0) + 1;
    return acc;
  }, {});
  const board = buildProgressBoard(state, projectId);
  return {
    project: compactProject(state, project),
    statusCounts,
    progress: board.projectProgress,
    activeSessions: board.activeSessions,
    riskSections: board.sections.filter((section) => section.kind !== "normal" && section.tasks.length > 0),
    members: state.projectMembers.filter((member) => member.projectId === projectId).map((member) => compactMember(state, member))
  };
};
var riskTasksView = (state, projectId) => {
  const projects = projectId ? state.projects.filter((project) => project.id === projectId) : state.projects.filter((project) => !project.archivedAt);
  return projects.flatMap(
    (project) => buildProgressBoard(state, project.id).sections.filter((section) => section.kind !== "normal").flatMap((section) => section.tasks.map((task) => ({ projectId: project.id, projectName: project.name, section: section.kind, ...task })))
  );
};
var searchView = (state, query, limit = 10) => {
  const normalized = query.trim().toLowerCase();
  const includes = (...values) => values.join(" ").toLowerCase().includes(normalized);
  if (!normalized) return { projects: [], members: [], tasks: [] };
  return {
    projects: state.projects.filter((project) => includes(project.name, project.description)).slice(0, limit).map((project) => compactProject(state, project)),
    members: state.projectMembers.filter((member) => includes(member.name, member.email)).slice(0, limit).map((member) => compactMember(state, member)),
    tasks: state.tasks.filter((task) => includes(task.title, task.notes, task.project, task.tags.join(" "))).slice(0, limit).map((task) => compactTask(state, task))
  };
};
var dailySummaryView = (state, date = today()) => {
  const plans = currentAccountDailyPlansForDate(state, date);
  const taskIds = new Set(plans.flatMap((plan) => plan.committedTaskIds));
  const sessions = state.workSessions.filter((session) => taskIds.has(session.taskId) || session.startedAt.slice(0, 10) === date);
  return {
    date,
    plans: plans.map((plan) => ({ ...plan, workspaceName: workspaceName(state, plan.workspaceId), tasks: planTasks(state, plan) })),
    totals: {
      plans: plans.length,
      tasks: taskIds.size,
      completedTasks: state.tasks.filter((task) => taskIds.has(task.id) && task.status === "completed").length,
      workSessions: sessions.length,
      completedPomodoros: plans.reduce((sum, plan) => sum + plan.completedPomodoros, 0)
    },
    workSessions: sessions.map((session) => sessionView(state, session)),
    interruptions: state.interruptions.filter((interruption) => interruption.createdAt.slice(0, 10) === date)
  };
};

// mcp-server/src/clientProjects.ts
var TimeManageMcpProjectClient = class extends TimeManageMcpBaseClient {
  async listProjects() {
    return listProjectViews(await this.authenticatedState());
  }
  async search(query, limit) {
    return searchView(await this.authenticatedState(), query, limit);
  }
  async getProjectOverview(projectId) {
    return projectOverviewView(await this.authenticatedState(), projectId);
  }
  async createProject(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = createProjectInTeamState(state, input, timestamp);
      const project = next.projects.find((item) => !state.projects.some((existing) => existing.id === item.id));
      return { state: next, result: project?.id };
    });
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === saved.result));
  }
  async updateProject(projectId, input) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: updateProjectInTeamState(state, projectId, input, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async archiveProject(projectId, confirmed) {
    requireConfirmation(confirmed, "archive_project");
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: archiveProjectInTeamState(state, projectId, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async restoreProject(projectId) {
    const saved = await this.mutate(projectId, (state, timestamp) => ({
      state: restoreProjectInTeamState(state, projectId, timestamp),
      result: projectId
    }));
    return compactProject(saved.state, saved.state.projects.find((project) => project.id === projectId));
  }
  async listMembers(projectId, includeDisabled = false) {
    const state = await this.authenticatedState();
    return state.projectMembers.filter((member) => (!projectId || member.projectId === projectId) && (includeDisabled || member.status !== "disabled")).map((member) => compactMember(state, member));
  }
  async createMember(input) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
      const next = createProjectMemberInTeamState(state, input, timestamp);
      const created = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      const matched = created ?? next.projectMembers.find(
        (member) => member.projectId === input.projectId && (input.accountId && member.accountId === input.accountId || input.email && member.email?.toLowerCase() === input.email.toLowerCase() || member.name === (input.name.trim() || "\u65B0\u6210\u5458"))
      );
      return { state: next, result: matched?.id };
    });
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result));
  }
  async updateMember(projectMemberId, input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateProjectMemberInTeamState(state, projectMemberId, input, timestamp),
      result: projectMemberId
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId));
  }
  async deleteMember(projectMemberId, confirmed) {
    requireConfirmation(confirmed, "delete_member");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: unbindProjectMemberInTeamState(state, projectMemberId, timestamp),
      result: projectMemberId
    }));
    return compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === projectMemberId));
  }
  async bindMemberToProject(projectId, memberRef, roles) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = bindMemberToProjectInTeamState(state, projectId, memberRef, roles, timestamp);
      const member = next.projectMembers.find((item) => !state.projectMembers.some((existing) => existing.id === item.id));
      return { state: next, result: member?.id };
    });
    return saved.result ? compactMember(saved.state, saved.state.projectMembers.find((member) => member.id === saved.result)) : void 0;
  }
  async updateProjectMember(projectMemberId, input) {
    return this.updateMember(projectMemberId, input);
  }
  async unbindProjectMember(projectMemberId, confirmed) {
    requireConfirmation(confirmed, "unbind_project_member");
    return this.deleteMember(projectMemberId, true);
  }
  async listRiskTasks(projectId) {
    return riskTasksView(await this.authenticatedState(), projectId);
  }
};

// mcp-server/src/clientTasks.ts
var TimeManageMcpTaskClient = class extends TimeManageMcpProjectClient {
  async listTasks(filter = {}) {
    return listTaskViews(await this.authenticatedState(), filter);
  }
  async getTask(taskId) {
    return taskDetailView(await this.authenticatedState(), taskId);
  }
  async createTask(input) {
    const saved = await this.mutate(input.projectId, (state, timestamp) => {
      const next = createTaskInTeamState(state, input, timestamp);
      const task = next.tasks.find((item) => !state.tasks.some((existing) => existing.id === item.id));
      return { state: next, result: task?.id };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result));
  }
  async batchCreateTasks(projectId, tasks) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      let next = state;
      const createdIds = [];
      for (const task of tasks) {
        const beforeIds = new Set(next.tasks.map((item) => item.id));
        next = createTaskInTeamState(next, { ...task, projectId }, timestamp);
        const created = next.tasks.find((item) => !beforeIds.has(item.id));
        if (created) createdIds.push(created.id);
      }
      return { state: next, result: createdIds };
    });
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)));
  }
  async updateTask(taskId, input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateTaskInTeamState(state, taskId, input, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async deleteTask(taskId, confirmed) {
    requireConfirmation(confirmed, "delete_task");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: deleteTaskInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return { deletedTaskId: taskId, savedAt: saved.savedAt };
  }
  async assignTask(taskId, assignment) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: assignTaskInTeamState(state, taskId, assignment, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async batchAssignTasks(taskIds, assignment) {
    const saved = await this.mutate(assignment.projectId, (state, timestamp) => ({
      state: taskIds.reduce((current, taskId) => assignTaskInTeamState(current, taskId, assignment, timestamp), state),
      result: taskIds
    }));
    return saved.result.map((taskId) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId)));
  }
  async setTaskStatus(taskId, status, confirmed) {
    if (status === "completed" || status === "split" || status === "archived") requireConfirmation(confirmed, "set_task_status");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: setTaskStatusInTeamState(state, taskId, status, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async updateTaskProgress(taskId, progressPercent, progressNote = "") {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateTaskProgressInTeamState(state, taskId, progressPercent, progressNote, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async splitTask(taskId, childTitles, confirmed) {
    requireConfirmation(confirmed, "split_task");
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = splitTaskInTeamState(state, taskId, childTitles, timestamp);
      return { state: next, result: next.tasks.filter((task) => !state.tasks.some((existing) => existing.id === task.id)).map((task) => task.id) };
    });
    return saved.result.map((id) => compactTask(saved.state, saved.state.tasks.find((task) => task.id === id)));
  }
};

// mcp-server/src/clientWorkflow.ts
var TimeManageMcpWorkflowClient = class extends TimeManageMcpTaskClient {
  async getTodayPlan(date) {
    return dailyPlanView(await this.authenticatedState(), date);
  }
  async getTodayWorkbench(projectId, date) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }
  async addTaskToToday(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: addTaskToTodayInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async batchAddTasksToToday(taskIds) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: batchAddTasksToTodayInTeamState(state, taskIds, timestamp),
      result: taskIds
    }));
    return dailyPlanView(saved.state);
  }
  async removeTaskFromToday(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: removeTaskFromTodayInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async moveTodayTask(taskId, direction) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: moveTodayTaskInTeamState(state, taskId, direction, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state);
  }
  async scheduleTaskForDate(taskId, date) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: scheduleTaskForDateInState(state, taskId, date, timestamp),
      result: taskId
    }));
    return dailyPlanView(saved.state, date);
  }
  async startTask(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: startTaskInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return activeWorkView(saved.state);
  }
  async pauseWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: pauseWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async resumeWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: resumeWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async finishWorkSession(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: finishWorkSessionInTeamState(state, input, timestamp),
      result: input
    }));
    return activeWorkView(saved.state);
  }
  async getActiveWork(projectId) {
    return activeWorkView(await this.authenticatedState(), projectId);
  }
  async recordInterruption(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = recordInterruptionInTeamState(state, input, timestamp);
      return { state: next, result: next.interruptions[0]?.id };
    });
    return saved.state.interruptions.find((item) => item.id === saved.result);
  }
  async submitTaskReview(taskId) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: submitTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async acceptTaskReview(taskId, confirmed) {
    requireConfirmation(confirmed, "accept_task_review");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: acceptTaskReviewInTeamState(state, taskId, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async returnTaskReview(taskId, reason) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: returnTaskReviewInTeamState(state, taskId, reason, timestamp),
      result: taskId
    }));
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === taskId));
  }
  async listPendingReviews(projectId) {
    return this.listTasks({ projectId, status: "pending_review", includeArchived: false, includeSplit: false });
  }
  async getMemberStatus(projectId, date) {
    return todayWorkbenchView(await this.authenticatedState(), projectId, date);
  }
  async getDailySummary(date) {
    return dailySummaryView(await this.authenticatedState(), date);
  }
  async updateDailyReview(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateDailyReviewInTeamState(state, input, timestamp),
      result: input.date
    }));
    return dailySummaryView(saved.state, input.date);
  }
  async getSettings() {
    return (await this.authenticatedState()).settings;
  }
  async updateSettings(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: updateSettingsInTeamState(state, input, timestamp),
      result: void 0
    }));
    return saved.state.settings;
  }
  async listTaskTemplates() {
    const state = await this.authenticatedState();
    return state.taskTemplates;
  }
  async saveTaskTemplate(input) {
    const saved = await this.mutate(void 0, (state, timestamp) => {
      const next = saveTaskTemplateInTeamState(state, input, timestamp);
      return { state: next, result: input.id ?? next.taskTemplates[0]?.id };
    });
    return saved.state.taskTemplates.find((template) => template.id === saved.result);
  }
  async deleteTaskTemplate(templateId, confirmed) {
    requireConfirmation(confirmed, "delete_task_template");
    const saved = await this.mutate(void 0, (state, timestamp) => ({
      state: deleteTaskTemplateInTeamState(state, templateId, timestamp),
      result: templateId
    }));
    return { deletedTemplateId: templateId, savedAt: saved.savedAt };
  }
  async instantiateTaskTemplate(templateId, projectId) {
    const saved = await this.mutate(projectId, (state, timestamp) => {
      const next = instantiateTaskTemplateInTeamState(state, templateId, projectId, timestamp);
      const taskId = next.templateInstances[0]?.taskId;
      return { state: next, result: taskId };
    });
    return compactTask(saved.state, saved.state.tasks.find((task) => task.id === saved.result));
  }
};

// mcp-server/src/core.ts
var TimeManageMcpClient = class extends TimeManageMcpWorkflowClient {
};

// mcp-server/src/cli.ts
var taskStatuses = ["pool", "committed", "in_progress", "pending_review", "completed", "split", "archived"];
var priorities = ["low", "medium", "high", "urgent"];
var severities = ["low", "medium", "high", "very_high"];
var taskStages = [
  "planning",
  "execution",
  "check",
  "sales",
  "requirements",
  "design",
  "development",
  "testing",
  "deployment",
  "acceptance"
];
var stageModes = ["regular", "software"];
var helpText = `TimeManage CLI\uFF1A\u4E00\u6B21\u547D\u4EE4\u4E00\u6B21\u8FDE\u63A5\uFF0C\u4E0D\u542F\u52A8\u5E38\u9A7B\u670D\u52A1\u3002

\u7528\u6CD5\uFF1A
  timemanage <\u547D\u4EE4> [\u53C2\u6570] [\u9009\u9879]

\u5168\u5C40\u9009\u9879\uFF1A
  --config <path>        \u914D\u7F6E\u6587\u4EF6\uFF0C\u9ED8\u8BA4 ${defaultConfigPath()}
  --server-url <url>     \u8986\u76D6\u670D\u52A1\u5668\u5730\u5740
  --email <account>      \u8986\u76D6\u8D26\u53F7
  --password <password>  \u8986\u76D6\u5BC6\u7801
  --device-id <id>       \u8986\u76D6\u8BBE\u5907 ID
  --json                 \u8F93\u51FA\u5B8C\u6574 JSON

\u4E1A\u52A1\u95ED\u73AF\u547D\u4EE4\uFF1A
  doctor                         \u68C0\u67E5\u8FDE\u63A5
  account                        \u67E5\u770B\u5F53\u524D\u8D26\u53F7\u548C\u5DE5\u4F5C\u533A
  projects                       \u5217\u9879\u76EE
  project <\u9879\u76EE\u540D\u6216ID>            \u770B\u9879\u76EE\u6982\u89C8
  tasks [--project <\u9879\u76EE\u540D\u6216ID>]  \u5217\u4EFB\u52A1
        [--status <\u72B6\u6001|all>] [--query <\u5173\u952E\u5B57>]
  today [--date YYYY-MM-DD]      \u770B\u4ECA\u65E5/\u6307\u5B9A\u65E5\u671F\u8BA1\u5212
  active                         \u770B\u5F53\u524D\u6267\u884C\u4E2D\u7684\u5DE5\u4F5C
  search <\u5173\u952E\u5B57>                \u641C\u7D22\u9879\u76EE\u3001\u6210\u5458\u3001\u4EFB\u52A1

\u5199\u5165\u547D\u4EE4\uFF1A
  create-project --name <\u540D\u79F0> [--description <\u8BF4\u660E>] [--mode regular|software]
  create-task --project <\u9879\u76EE\u540D\u6216ID> --title <\u6807\u9898> [--notes <\u8BF4\u660E>]
              [--priority low|medium|high|urgent] [--due <ISO\u65F6\u95F4>]
  add-today <\u4EFB\u52A1\u540D\u6216ID>          \u52A0\u5165\u4ECA\u65E5\u8BA1\u5212
  start <\u4EFB\u52A1\u540D\u6216ID>              \u5F00\u59CB\u6267\u884C\u4EFB\u52A1
  progress <\u4EFB\u52A1\u540D\u6216ID> <0-100> [--note <\u8BF4\u660E>]
  complete <\u4EFB\u52A1\u540D\u6216ID> --yes     \u6807\u8BB0\u5B8C\u6210\uFF0C\u9700\u8981 --yes

\u4F8B\u5B50\uFF1A
  timemanage projects
  timemanage tasks --project \u56E2\u961F\u534F\u52A9\u8F6F\u4EF6
  timemanage progress \u63A5\u5165\u8868\u5355 60 --note \u5DF2\u8054\u901A\u63A5\u53E3
`;
var parseCli = (argv) => {
  const flags = {};
  const positional = [];
  const env = { ...process.env };
  let command;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg.startsWith("--")) {
      const withoutPrefix = arg.slice(2);
      const [rawName, inlineValue] = withoutPrefix.split("=", 2);
      const next = argv[index + 1];
      const value = inlineValue ?? (next && !next.startsWith("--") ? next : true);
      if (inlineValue === void 0 && value !== true) index += 1;
      flags[rawName] = value;
      continue;
    }
    if (!command) command = arg;
    else positional.push(arg);
  }
  const applyEnv = (flag, envName) => {
    const value = flags[flag];
    if (typeof value === "string") env[envName] = value;
  };
  applyEnv("config", "TM_MCP_CONFIG");
  applyEnv("server-url", "TM_MCP_SERVER_URL");
  applyEnv("email", "TM_MCP_EMAIL");
  applyEnv("password", "TM_MCP_PASSWORD");
  applyEnv("device-id", "TM_MCP_DEVICE_ID");
  return { command, positional, flags, json: flags.json === true, env };
};
var flagString = (flags, name) => {
  const value = flags[name];
  return typeof value === "string" ? value : void 0;
};
var hasFlag = (flags, name) => flags[name] === true || flags[name] === "true";
var requireFlagString = (flags, name) => {
  const value = flagString(flags, name);
  if (!value) throw new Error(`Missing --${name}`);
  return value;
};
var requirePositional = (parsed, index, label) => {
  const value = parsed.positional[index];
  if (!value) throw new Error(`Missing ${label}`);
  return value;
};
var isTaskStatus = (value) => taskStatuses.includes(value);
var isPriority = (value) => priorities.includes(value);
var isSeverity = (value) => severities.includes(value);
var isTaskStage = (value) => taskStages.includes(value);
var isStageMode = (value) => stageModes.includes(value);
var parseTaskStatus = (value) => {
  if (!value) return void 0;
  if (value === "all") return "all";
  if (isTaskStatus(value)) return value;
  throw new Error(`Invalid status: ${value}`);
};
var parseNumber = (value, label, min, max) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) throw new Error(`${label} must be a number.`);
  if (min !== void 0 && numberValue < min) throw new Error(`${label} must be >= ${min}.`);
  if (max !== void 0 && numberValue > max) throw new Error(`${label} must be <= ${max}.`);
  return numberValue;
};
var resolveProjectId = async (client, projectRef) => {
  if (!projectRef) return void 0;
  const projects = await client.listProjects();
  const exact = projects.filter((project) => project.id === projectRef || project.name === projectRef);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) throw new Error(`Project ref is ambiguous: ${projectRef}`);
  const fuzzy = projects.filter((project) => project.name.includes(projectRef));
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (fuzzy.length > 1) throw new Error(`Project ref is ambiguous: ${projectRef}. Matches: ${fuzzy.map((project) => project.name).join(", ")}`);
  throw new Error(`Project not found: ${projectRef}`);
};
var resolveTaskId = async (client, taskRef, projectId) => {
  const tasks = await client.listTasks({ projectId, status: "all", includeArchived: true, includeSplit: true });
  const exact = tasks.filter((task) => task.id === taskRef || task.title === taskRef);
  if (exact.length === 1) return exact[0].id;
  if (exact.length > 1) throw new Error(`Task ref is ambiguous: ${taskRef}`);
  const fuzzy = tasks.filter((task) => task.title.includes(taskRef));
  if (fuzzy.length === 1) return fuzzy[0].id;
  if (fuzzy.length > 1) throw new Error(`Task ref is ambiguous: ${taskRef}. Matches: ${fuzzy.map((task) => task.title).join(", ")}`);
  throw new Error(`Task not found: ${taskRef}`);
};
var commandResult = async (client, parsed) => {
  const command = parsed.command;
  if (!command || command === "help" || command === "--help" || command === "-h") return { kind: "message", message: helpText };
  if (command === "doctor" || command === "health") return { kind: "json", data: await client.getBackendDiagnostics() };
  if (command === "account") return { kind: "json", data: await client.getCurrentAccount() };
  if (command === "workspaces") return { kind: "json", data: await client.listWorkspaces() };
  if (command === "projects") return { kind: "projects", data: await client.listProjects() };
  if (command === "search") return { kind: "search", data: await client.search(requirePositional(parsed, 0, "query")) };
  if (command === "project") {
    const projectId = await resolveProjectId(client, requirePositional(parsed, 0, "project"));
    return { kind: "overview", data: await client.getProjectOverview(projectId) };
  }
  if (command === "tasks") {
    const projectId = await resolveProjectId(client, flagString(parsed.flags, "project"));
    const status = parseTaskStatus(flagString(parsed.flags, "status"));
    return { kind: "tasks", data: await client.listTasks({ projectId, status, query: flagString(parsed.flags, "query") }) };
  }
  if (command === "today") return { kind: "today", data: await client.getTodayPlan(flagString(parsed.flags, "date")) };
  if (command === "active") return { kind: "active", data: await client.getActiveWork() };
  if (command === "create-project") {
    const mode = flagString(parsed.flags, "mode");
    if (mode && !isStageMode(mode)) throw new Error(`Invalid mode: ${mode}`);
    const input = {
      name: requireFlagString(parsed.flags, "name"),
      description: flagString(parsed.flags, "description"),
      taskStageMode: hasFlag(parsed.flags, "software") ? "software" : mode
    };
    return { kind: "overview", data: { project: await client.createProject(input), statusCounts: {}, progress: 0, activeSessions: [], riskSections: [], members: [] } };
  }
  if (command === "create-task") {
    const priority = flagString(parsed.flags, "priority");
    const severity = flagString(parsed.flags, "severity");
    const stage = flagString(parsed.flags, "stage");
    if (priority && !isPriority(priority)) throw new Error(`Invalid priority: ${priority}`);
    if (severity && !isSeverity(severity)) throw new Error(`Invalid severity: ${severity}`);
    if (stage && !isTaskStage(stage)) throw new Error(`Invalid stage: ${stage}`);
    const input = {
      projectId: await resolveProjectId(client, requireFlagString(parsed.flags, "project")),
      title: requireFlagString(parsed.flags, "title"),
      notes: flagString(parsed.flags, "notes"),
      priority,
      severity,
      stage,
      dueAt: flagString(parsed.flags, "due")
    };
    return { kind: "task", data: await client.createTask(input) };
  }
  if (command === "add-today") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "today", data: await client.addTaskToToday(taskId) };
  }
  if (command === "start") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "active", data: await client.startTask(taskId) };
  }
  if (command === "progress") {
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    const progressPercent = parseNumber(requirePositional(parsed, 1, "progress"), "progress", 0, 100);
    return { kind: "task", data: await client.updateTaskProgress(taskId, progressPercent, flagString(parsed.flags, "note")) };
  }
  if (command === "complete") {
    if (!hasFlag(parsed.flags, "yes")) throw new Error("complete requires --yes.");
    const taskId = await resolveTaskId(client, requirePositional(parsed, 0, "task"));
    return { kind: "task", data: await client.setTaskStatus(taskId, "completed", true) };
  }
  throw new Error(`Unknown command: ${command}`);
};
var line = (value) => process.stdout.write(`${value}
`);
var writeJson = (data) => line(JSON.stringify(data, null, 2));
var taskLine = (task) => {
  const owner = task.primaryExecutorName ? ` @${task.primaryExecutorName}` : "";
  const project = task.project ? ` [${task.project}]` : "";
  const due = task.dueAt ? ` due:${task.dueAt.slice(0, 10)}` : "";
  return `${task.title}${project} \u2014 ${task.status} ${task.progressPercent}%${owner}${due} (${task.id})`;
};
var printProjects = (projects) => {
  if (!projects.length) return line("\u6CA1\u6709\u9879\u76EE\u3002");
  for (const project of projects) {
    line(`${project.name} \u2014 ${project.taskCount} \u4E2A\u4EFB\u52A1\uFF0C${project.memberCount} \u4E2A\u6210\u5458\uFF0C${project.workspaceName ?? "\u672A\u547D\u540D\u5DE5\u4F5C\u533A"} (${project.id})`);
  }
};
var printTasks = (tasks) => {
  if (!tasks.length) return line("\u6CA1\u6709\u4EFB\u52A1\u3002");
  for (const task of tasks) line(taskLine(task));
};
var printToday = (plan) => {
  const tasks = plan.combined?.tasks ?? [];
  line(`${plan.date} \u4ECA\u65E5\u8BA1\u5212\uFF1A${tasks.length} \u4E2A\u4EFB\u52A1`);
  printTasks(tasks);
};
var printActive = (sessions) => {
  if (!sessions.length) return line("\u5F53\u524D\u6CA1\u6709\u6267\u884C\u4E2D\u6216\u6682\u505C\u4E2D\u7684\u5DE5\u4F5C\u3002");
  for (const session of sessions) {
    const task = session.task ? taskLine(session.task) : session.id;
    line(`${session.status} \u2014 ${task}\uFF0C\u6267\u884C\u4EBA\uFF1A${session.executorName ?? "\u672A\u5206\u914D"}`);
  }
};
var printSearch = (result) => {
  line(`\u9879\u76EE\uFF1A${result.projects.length}`);
  printProjects(result.projects);
  line(`\u6210\u5458\uFF1A${result.members.length}`);
  for (const member of result.members) line(`${member.name}${member.projectName ? ` [${member.projectName}]` : ""} (${member.id})`);
  line(`\u4EFB\u52A1\uFF1A${result.tasks.length}`);
  printTasks(result.tasks);
};
var printOverview = (overview) => {
  line(`${overview.project.name} \u2014 ${overview.project.taskCount} \u4E2A\u4EFB\u52A1\uFF0C${overview.project.memberCount} \u4E2A\u6210\u5458`);
  line(`\u8FDB\u5EA6\uFF1A${overview.progress}%`);
  line(`\u72B6\u6001\uFF1A${Object.entries(overview.statusCounts).map(([status, count]) => `${status}:${count}`).join("\uFF0C") || "\u65E0"}`);
  line(`\u98CE\u9669\u5206\u533A\uFF1A${overview.riskSections.length}\uFF0C\u6D3B\u8DC3\u4F1A\u8BDD\uFF1A${overview.activeSessions.length}`);
};
var resultData = (result) => {
  if (result.kind === "message") return result.data ?? result.message;
  return result.data;
};
var printResult = (result, json) => {
  if (json || result.kind === "json") return writeJson(resultData(result));
  if (result.kind === "message") {
    line(result.message);
    if (result.data) writeJson(result.data);
    return;
  }
  if (result.kind === "projects") return printProjects(result.data);
  if (result.kind === "tasks") return printTasks(result.data);
  if (result.kind === "today") return printToday(result.data);
  if (result.kind === "active") return printActive(result.data);
  if (result.kind === "search") return printSearch(result.data);
  if (result.kind === "overview") return printOverview(result.data);
  if (result.kind === "task") return line(taskLine(result.data));
};
var main = async () => {
  const parsed = parseCli(process.argv.slice(2));
  if (!parsed.command || parsed.command === "help" || parsed.command === "--help" || parsed.command === "-h") {
    line(helpText);
    return;
  }
  const client = new TimeManageMcpClient(loadConfig(parsed.env));
  printResult(await commandResult(client, parsed), parsed.json);
};
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
