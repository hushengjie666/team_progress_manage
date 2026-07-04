import { createInitialState } from "../../src/seed.js";
import { loginToWorkspace, type AuthSession } from "../../src/teamBackend.js";
import { loadTeamData, saveTeamDataSnapshot } from "../../src/teamApi.js";
import type { AppState } from "../../src/types.js";
import type { TimeManageMcpConfig } from "./config.js";
import { createEmptyBackendConnectionState, hydrateCurrentMember, nowIso } from "./coreBackendConnectionState.js";

export class TimeManageMcpBaseClient {
  protected session?: AuthSession;

  constructor(protected readonly config: TimeManageMcpConfig) {}

  protected async ensureSession() {
    if (this.session && new Date(this.session.expiresAt).getTime() > Date.now() + 60_000) return this.session;
    const seed = createInitialState();
    this.session = await loginToWorkspace(
      { ...seed.backend, serverUrl: this.config.serverUrl, deviceId: this.config.deviceId },
      this.config.email,
      this.config.password,
    );
    return this.session;
  }

  async readState(preferredProjectId?: string) {
    const session = await this.ensureSession();
    const baseState = createEmptyBackendConnectionState(this.config, session);
    const loaded = await loadTeamData(baseState);
    return hydrateCurrentMember(loaded, session, preferredProjectId);
  }

  async writeState(_beforeState: AppState, nextState: AppState, preferredProjectId?: string) {
    const session = await this.ensureSession();
    const next = {
      ...nextState,
      auth: { ...nextState.auth, status: "authenticated" as const, token: session.token, account: session.account, workspace: session.workspace, expiresAt: session.expiresAt },
      backend: { ...nextState.backend, serverUrl: this.config.serverUrl, token: session.token, username: session.account.email, deviceId: this.config.deviceId },
    };
    const savedAt = nowIso();
    const saved = await saveTeamDataSnapshot(next.backend, session.token, {
      ...next,
      backend: {
        ...next.backend,
        lastSavedAt: savedAt,
        status: "ready" as const,
        message: "MCP 已写入团队后台",
      },
      updatedAt: savedAt,
    });
    return hydrateCurrentMember(await loadTeamData(saved), session, preferredProjectId);
  }

  async mutate<T>(preferredProjectId: string | undefined, fn: (state: AppState, timestamp: string) => { state: AppState; result: T } | AppState) {
    const timestamp = nowIso();
    const state = await this.readState(preferredProjectId);
    const output = fn(state, timestamp);
    const nextState = "state" in output ? output.state : output;
    const saved = await this.writeState(state, nextState, preferredProjectId);
    return "state" in output ? output.result : { savedAt: saved.backend.lastSavedAt };
  }
}
