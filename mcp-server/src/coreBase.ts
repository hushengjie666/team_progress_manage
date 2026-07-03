import { createInitialState } from "../../src/seed.js";
import { loginToWorkspace, type AuthSession } from "../../src/sync.js";
import { loadTeamState, pushTeamChanges } from "../../src/teamApi.js";
import type { AppState } from "../../src/types.js";
import type { TimeManageMcpConfig } from "./config.js";
import { createEmptySyncState, hydrateCurrentMember, nowIso } from "./coreSyncState.js";

export class TimeManageMcpBaseClient {
  protected session?: AuthSession;

  constructor(protected readonly config: TimeManageMcpConfig) {}

  protected async ensureSession() {
    if (this.session && new Date(this.session.expiresAt).getTime() > Date.now() + 60_000) return this.session;
    const seed = createInitialState();
    this.session = await loginToWorkspace(
      { ...seed.sync, serverUrl: this.config.serverUrl, deviceId: this.config.deviceId },
      this.config.email,
      this.config.password,
    );
    return this.session;
  }

  async readState(preferredProjectId?: string) {
    const session = await this.ensureSession();
    const baseState = createEmptySyncState(this.config, session);
    const loaded = await loadTeamState(baseState);
    return hydrateCurrentMember(loaded, session, preferredProjectId);
  }

  async writeState(beforeState: AppState, nextState: AppState, preferredProjectId?: string) {
    const session = await this.ensureSession();
    const before = {
      ...beforeState,
      auth: { ...beforeState.auth, status: "authenticated" as const, token: session.token, account: session.account, workspace: session.workspace, expiresAt: session.expiresAt },
      sync: { ...beforeState.sync, serverUrl: this.config.serverUrl, token: session.token, username: session.account.email, deviceId: this.config.deviceId },
    };
    const next = {
      ...nextState,
      auth: { ...nextState.auth, status: "authenticated" as const, token: session.token, account: session.account, workspace: session.workspace, expiresAt: session.expiresAt },
      sync: { ...nextState.sync, serverUrl: this.config.serverUrl, token: session.token, username: session.account.email, deviceId: this.config.deviceId },
    };
    const revision = await pushTeamChanges(next.sync, session.token, before, next);
    const savedAt = nowIso();
    const saved = {
      ...next,
      sync: {
        ...next.sync,
        lastPulledRevision: Math.max(next.sync.lastPulledRevision, revision ?? next.sync.lastPulledRevision),
        lastSyncedAt: savedAt,
        status: "synced" as const,
        message: revision === undefined ? "MCP 没有团队变更需要写入" : "MCP 已写入团队后台",
      },
      updatedAt: savedAt,
    };
    return hydrateCurrentMember(await loadTeamState(saved), session, preferredProjectId);
  }

  async mutate<T>(preferredProjectId: string | undefined, fn: (state: AppState, timestamp: string) => { state: AppState; result: T } | AppState) {
    const timestamp = nowIso();
    const state = await this.readState(preferredProjectId);
    const output = fn(state, timestamp);
    const nextState = "state" in output ? output.state : output;
    const synced = await this.writeState(state, nextState, preferredProjectId);
    return "state" in output ? output.result : { syncedAt: synced.sync.lastSyncedAt };
  }
}
