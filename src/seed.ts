import type { AppState } from "./types";
import { defaultBackendServerUrl } from "./defaultBackendServerUrl";
import {
  defaultTaskTemplates,
  starterProject,
  starterProjectMember,
} from "./initialSeedData";

const padDatePart = (value: number) => String(value).padStart(2, "0");

export const todayKey = (date = new Date()) =>
  `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;

export const uid = (prefix: string) => {
  const value =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${value}`;
};

const now = () => new Date().toISOString();

export { defaultBackendServerUrl } from "./defaultBackendServerUrl";
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
    timerEndSoundVolume: 100,
    timerEndSoundRepeats: 1,
    notificationSettings: {
      permissionState: "unknown",
    },
    advancedBackendVisible: false,
    commandPaletteHintDismissed: false,
    devTimerSpeed100xEnabled: false,
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
  backend: {
    serverUrl: defaultBackendServerUrl(),
    username: "admin",
    deviceId: uid("device"),
    status: "idle",
    message: "本地团队后台未连接",
  },
  taskTemplates: defaultTaskTemplates,
  templateInstances: [],
  updatedAt: now(),
});
