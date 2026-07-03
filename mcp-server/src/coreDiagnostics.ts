import { getTeamRevision } from "../../src/teamApi.js";
import { TimeManageMcpTaskClient } from "./coreTasks.js";
import { uniqueProjectMembers } from "./coreProjectModel.js";

export class TimeManageMcpDiagnosticsClient extends TimeManageMcpTaskClient {
  async getSyncDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.readState();
    const revision = await getTeamRevision(state.sync, session.token);
    return {
      serverUrl: this.config.serverUrl,
      deviceId: this.config.deviceId,
      account: {
        id: session.account.id,
        email: session.account.email,
        name: session.account.name,
      },
      local: {
        lastPulledRevision: state.sync.lastPulledRevision,
        lastSyncedAt: state.sync.lastSyncedAt,
        status: state.sync.status,
        message: state.sync.message,
        tombstoneCount: state.sync.tombstones?.length ?? 0,
      },
      remote: {
        currentRevision: revision,
      },
      counts: {
        projects: state.projects.length,
        members: uniqueProjectMembers(state.projectMembers).length,
        projectMembers: state.projectMembers.length,
        tasks: state.tasks.length,
        dailyPlans: state.dailyPlans.length,
        workSessions: state.workSessions.length,
        executionSignals: state.executionSignals.length,
      },
    };
  }
}
