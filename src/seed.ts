import type { AppState } from "./types";
import { defaultSyncServerUrl } from "./defaultSyncServerUrl";
import {
  defaultTaskTemplates,
  starterProject,
  starterProjectMember,
} from "./initialSeedData";

export const todayKey = (date = new Date()) => date.toISOString().slice(0, 10);

export const uid = (prefix: string) => {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
};

const now = () => new Date().toISOString();

export { defaultSyncServerUrl } from "./defaultSyncServerUrl";
export {
  defaultTaskTemplates,
  starterProject,
  starterProjectMember,
} from "./initialSeedData";

export const createInitialState = (): AppState => ({
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
      permissionState: "unknown",
    },
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
    message: "请使用管理员分配的账号登录",
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
    badges: ["首个承诺"],
    focusGarden: 0,
    visualProgress: 0,
  },
  sync: {
    serverUrl: defaultSyncServerUrl(),
    username: "admin",
    deviceId: uid("device"),
    lastPulledRevision: 0,
    status: "idle",
    message: "本地团队后台未连接",
    tombstones: [],
  },
  backupSnapshots: [],
  taskTemplates: defaultTaskTemplates,
  templateInstances: [],
  updatedAt: now(),
});
