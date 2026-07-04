import { TimeManageMcpTaskClient } from "./coreTasks.js";
import { uniqueProjectMembers } from "./coreProjectModel.js";

export class TimeManageMcpDiagnosticsClient extends TimeManageMcpTaskClient {
  async getBackendDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.readState();
    return {
      serverUrl: this.config.serverUrl,
      deviceId: this.config.deviceId,
      account: {
        id: session.account.id,
        email: session.account.email,
        name: session.account.name,
      },
      backend: {
        lastLoadedAt: state.backend.lastLoadedAt,
        lastSavedAt: state.backend.lastSavedAt,
        status: state.backend.status,
        message: state.backend.message,
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
