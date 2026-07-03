import { createInitialState } from "../../src/seed.js";
import type { AuthSession } from "../../src/sync.js";
import type { AppState } from "../../src/types.js";
import type { TimeManageMcpConfig } from "./config.js";

const emptyDate = "1970-01-01T00:00:00.000Z";

export const nowIso = () => new Date().toISOString();

export const createEmptySyncState = (config: TimeManageMcpConfig, session: AuthSession): AppState => {
  const initial = createInitialState();
  return {
    ...initial,
    projects: [],
    projectMembers: [],
    tasks: [],
    dailyPlans: [],
    focusSessions: [],
    workSessions: [],
    executionSignals: [],
    interruptions: [],
    backupSnapshots: [],
    taskTemplates: [],
    templateInstances: [],
    auth: {
      status: "authenticated",
      token: session.token,
      account: session.account,
      workspace: session.workspace,
      expiresAt: session.expiresAt,
      bootstrapped: true,
      message: "MCP 已登录团队工作区",
    },
    sync: {
      ...initial.sync,
      serverUrl: config.serverUrl,
      username: session.account.email,
      token: session.token,
      deviceId: config.deviceId,
      lastPulledRevision: 0,
      status: "idle",
      message: "MCP 已连接团队后台",
      tombstones: [],
    },
    updatedAt: emptyDate,
  };
};

export const hydrateCurrentMember = (state: AppState, _session: AuthSession, _preferredProjectId?: string): AppState => state;
