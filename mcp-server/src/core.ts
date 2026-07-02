import { buildInsights, buildProgressBoard, defaultReview } from "../../src/domain.js";
import { createProjectTaskInState, type ProjectTaskInput } from "../../src/projectDetail.js";
import { resolveMemberIdForProject } from "../../src/memberIdentity.js";
import { createInitialState, todayKey, uid } from "../../src/seed.js";
import { loginToWorkspace, mergeRowsIntoState, syncAppState, type AuthSession } from "../../src/sync.js";
import {
  addProjectMemberToState,
  acceptTaskInState,
  assignTaskInState,
  createProjectInState,
  projectMembersForProject,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectInState,
  updateProjectMemberInState,
  updateTaskProgressInState,
} from "../../src/teamProgress.js";
import type {
  AppState,
  DailyPlan,
  DailyReview,
  Priority,
  Project,
  ProjectMember,
  ProjectMemberRole,
  RepeatRule,
  Severity,
  Task,
  TaskStage,
  TaskStatus,
} from "../../src/types.js";
import {
  addTaskToTodayInState as addToTodayInState,
  ensurePlanInState,
  finishWorkSessionInState as finishWorkSessionState,
  pauseWorkSessionInState as pauseWorkSessionState,
  removeTaskFromTodayQueueInState as removeFromTodayInState,
  resumeWorkSessionInState as resumeWorkSessionState,
  sortedByUpdatedAt,
  startWorkSessionInState,
} from "../../src/workSessionTransitions.js";
import type { TimeManageMcpConfig } from "./config.js";

interface PullResponse {
  changes: Array<{
    entity: string;
    id: string;
    device_id: string;
    updated_at: string;
    deleted_at?: string;
    revision: number;
    version: number;
    payload: unknown;
  }>;
  current_revision: number;
}

type TaskListFilter = {
  projectId?: string;
  status?: TaskStatus | "all";
  assigneeMemberId?: string;
  query?: string;
  includeArchived?: boolean;
  includeSplit?: boolean;
};

type CreateTaskInput = ProjectTaskInput & {
  projectId: string;
};

type UpdateTaskInput = Partial<{
  title: string;
  notes: string;
  tags: string[];
  priority: Priority;
  severity: Severity;
  stage: TaskStage;
  estimateHours: number;
  estimatePomodoros: number;
  expectedStartAt: string;
  expectedFinishAt: string;
  dueAt: string;
  reminderAt: string;
  repeatRule: RepeatRule;
  repeatIntervalDays: number;
  subtasks: string[];
}>;

type CreateProjectInput = {
  name: string;
  description?: string;
  defaultExpectedStartHours?: number;
  taskStageMode?: "regular" | "software";
};

type UpdateProjectInput = Partial<{
  name: string;
  description: string;
  defaultExpectedStartHours: number;
  taskStageMode: "regular" | "software";
}>;

type CreateMemberInput = {
  projectId: string;
  name: string;
  email?: string;
  accountId?: string;
  roles?: ProjectMemberRole[];
};

type UpdateMemberInput = Partial<{
  name: string;
  email: string;
  status: "active" | "disabled";
}>;

type DailyReviewPatch = Partial<DailyReview> & {
  reflection?: string;
  reviewed?: boolean;
};

const emptyDate = "1970-01-01T00:00:00.000Z";

const apiUrl = (serverUrl: string, path: string) => `${serverUrl.replace(/\/+$/, "")}${path}`;

const nowIso = () => new Date().toISOString();

const authHeaders = (token?: string) => ({
  "Content-Type": "application/json",
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const readResponse = async <T>(response: Response): Promise<T> => {
  if (response.ok) return response.json() as Promise<T>;
  let message = `${response.status} ${response.statusText}`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    const text = await response.text().catch(() => "");
    if (text) message = text;
  }
  throw new Error(message);
};

const createEmptySyncState = (config: TimeManageMcpConfig, session: AuthSession): AppState => {
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
    strictViolations: [],
    blockProfiles: [],
    backupSnapshots: [],
    taskTemplates: [],
    templateInstances: [],
    nativeCapabilities: [],
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
      enabled: true,
      serverUrl: config.serverUrl,
      username: session.account.email,
      token: session.token,
      deviceId: config.deviceId,
      autoSync: true,
      lastPulledRevision: 0,
      status: "idle",
      message: "MCP 已连接团队后台",
      tombstones: [],
      conflicts: [],
    },
    updatedAt: emptyDate,
  };
};

const hydrateCurrentMember = (state: AppState, _session: AuthSession, _preferredProjectId?: string): AppState => state;

const compactTask = (state: AppState, task: Task) => {
  const executor = task.primaryExecutorMemberId
    ? state.projectMembers.find((member) => member.id === task.primaryExecutorMemberId)
    : undefined;
  return {
    id: task.id,
    title: task.title,
    projectId: task.projectId,
    project: task.project,
    status: task.status,
    primaryExecutorMemberId: task.primaryExecutorMemberId,
    primaryExecutorName: executor?.name,
    priority: task.priority,
    severity: task.severity,
    stage: task.stage,
    progressPercent: task.progressPercent ?? 0,
    estimatePomodoros: task.estimatePomodoros,
    actualPomodoros: task.actualPomodoros,
    dueAt: task.dueAt,
    updatedAt: task.updatedAt,
  };
};

const actorMemberIdForTask = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ? resolveMemberIdForProject(state, task.projectId) : undefined;
};

const taskMatchesFilter = (task: Task, filter: TaskListFilter) => {
  if (filter.projectId && task.projectId !== filter.projectId) return false;
  if ((filter.status ?? "all") !== "all" && task.status !== filter.status) return false;
  if (!filter.includeArchived && task.status === "archived") return false;
  if (!filter.includeSplit && task.status === "split") return false;
  if (filter.assigneeMemberId && task.primaryExecutorMemberId !== filter.assigneeMemberId) return false;
  const query = filter.query?.trim().toLowerCase();
  if (query) {
    const searchable = `${task.title} ${task.notes} ${task.tags.join(" ")} ${task.project}`.toLowerCase();
    if (!searchable.includes(query)) return false;
  }
  return true;
};

const removeTaskReferences = (state: AppState, taskId: string, timestamp: string) => {
  const relatedWorkSessions = state.workSessions.filter((session) => session.taskId === taskId);
  const relatedWorkSessionIds = new Set(relatedWorkSessions.map((session) => session.id));
  const relatedFocusSessions = state.focusSessions.filter((session) => session.taskId === taskId);
  const relatedSignals = state.executionSignals.filter((signal) => signal.taskId === taskId || relatedWorkSessionIds.has(signal.workSessionId));
  return {
    ...state,
    tasks: state.tasks.filter((task) => task.id !== taskId),
    workSessions: state.workSessions.filter((session) => session.taskId !== taskId),
    focusSessions: state.focusSessions.filter((session) => session.taskId !== taskId),
    executionSignals: state.executionSignals.filter((signal) => signal.taskId !== taskId && !relatedWorkSessionIds.has(signal.workSessionId)),
    dailyPlans: state.dailyPlans.map((plan) => ({
      ...plan,
      committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId),
      suggestedTaskIds: plan.suggestedTaskIds.filter((id) => id !== taskId),
      updatedAt:
        plan.committedTaskIds.includes(taskId) || plan.suggestedTaskIds.includes(taskId)
          ? timestamp
          : plan.updatedAt,
    })),
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []),
        { entity: "task", id: taskId, deletedAt: timestamp },
        ...relatedWorkSessions.map((session) => ({ entity: "work_session" as const, id: session.id, deletedAt: timestamp })),
        ...relatedFocusSessions.map((session) => ({ entity: "focus_session" as const, id: session.id, deletedAt: timestamp })),
        ...relatedSignals.map((signal) => ({ entity: "execution_signal" as const, id: signal.id, deletedAt: timestamp })),
      ],
    },
    updatedAt: timestamp,
  };
};

const activeWorkSessionsForTasks = (state: AppState, tasks: Task[]) => {
  const taskIds = new Set(tasks.map((task) => task.id));
  return sortedByUpdatedAt(state.workSessions).filter(
    (session) => taskIds.has(session.taskId) && (session.status === "active" || session.status === "paused"),
  );
};

const memberLabel = (member?: ProjectMember) => member?.name || member?.email || "未分配";

const projectMemberIdentity = (member: ProjectMember) => member.accountId || member.email?.toLowerCase() || member.id;

const uniqueProjectMembers = (members: ProjectMember[]) => {
  const seen = new Set<string>();
  return sortedByUpdatedAt(members).filter((member) => {
    const identity = projectMemberIdentity(member);
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
};

const compactProject = (state: AppState, project: Project) => {
  const tasks = state.tasks.filter((task) => task.projectId === project.id && task.status !== "archived" && task.status !== "split");
  const members = projectMembersForProject(state, project.id);
  const board = buildProgressBoard(state, project.id);
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    defaultExpectedStartHours: project.defaultExpectedStartHours,
    taskStageMode: project.taskStageMode ?? "software",
    archivedAt: project.archivedAt,
    progressPercent: board.projectProgress,
    taskCount: tasks.length,
    memberCount: members.length,
    pendingReviewCount: tasks.filter((task) => task.status === "pending_review").length,
    inProgressCount: tasks.filter((task) => task.status === "in_progress").length,
    riskCount: board.sections.reduce((sum, section) => sum + (section.kind === "normal" ? 0 : section.tasks.length), 0),
    updatedAt: project.updatedAt,
  };
};

const unbindProjectMemberInState = (state: AppState, projectMemberId: string, timestamp: string): AppState => {
  const member = state.projectMembers.find((item) => item.id === projectMemberId);
  if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
  return {
    ...state,
    projectMembers: state.projectMembers.filter((item) => item.id !== projectMemberId),
    tasks: state.tasks.map((task) => {
      const touched =
        task.creatorMemberId === projectMemberId ||
        task.primaryExecutorMemberId === projectMemberId ||
        task.collaboratorMemberIds?.includes(projectMemberId);
      return touched
        ? {
            ...task,
            creatorMemberId: task.creatorMemberId === projectMemberId ? undefined : task.creatorMemberId,
            primaryExecutorMemberId: task.primaryExecutorMemberId === projectMemberId ? undefined : task.primaryExecutorMemberId,
            collaboratorMemberIds: task.collaboratorMemberIds?.filter((id) => id !== projectMemberId) ?? [],
            updatedAt: timestamp,
          }
        : task;
    }),
    sync: {
      ...state.sync,
      tombstones: [
        ...(state.sync.tombstones ?? []).filter((item) => !(item.entity === "project_member" && item.id === projectMemberId)),
        { entity: "project_member", id: projectMemberId, deletedAt: timestamp },
      ],
    },
    updatedAt: timestamp,
  };
};

export class TimeManageMcpClient {
  private session?: AuthSession;

  constructor(private readonly config: TimeManageMcpConfig) {}

  private async ensureSession() {
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
    const response = await fetch(apiUrl(this.config.serverUrl, "/sync/pull?since=0"), {
      headers: authHeaders(session.token),
    });
    const pulled = await readResponse<PullResponse>(response);
    const merged = mergeRowsIntoState(baseState, pulled.changes as never, pulled.current_revision);
    return hydrateCurrentMember(merged, session, preferredProjectId);
  }

  async writeState(nextState: AppState, preferredProjectId?: string) {
    const session = await this.ensureSession();
    const synced = await syncAppState({
      ...nextState,
      auth: { ...nextState.auth, status: "authenticated", token: session.token, account: session.account, workspace: session.workspace, expiresAt: session.expiresAt },
      sync: { ...nextState.sync, serverUrl: this.config.serverUrl, token: session.token, username: session.account.email, deviceId: this.config.deviceId },
    });
    return hydrateCurrentMember(synced, session, preferredProjectId);
  }

  async mutate<T>(preferredProjectId: string | undefined, fn: (state: AppState, timestamp: string) => { state: AppState; result: T } | AppState) {
    const timestamp = nowIso();
    const state = await this.readState(preferredProjectId);
    const output = fn(state, timestamp);
    const nextState = "state" in output ? output.state : output;
    const synced = await this.writeState(nextState, preferredProjectId);
    return "state" in output ? output.result : { syncedAt: synced.sync.lastSyncedAt };
  }

  async listProjects() {
    const state = await this.readState();
    return sortedByUpdatedAt(state.projects.filter((project) => !project.archivedAt)).map((project) => compactProject(state, project));
  }

  async search(query: string, limit = 10) {
    const state = await this.readState();
    const normalized = query.trim().toLowerCase();
    if (!normalized) return { projects: [], members: [], tasks: [] };
    const includes = (...values: Array<string | undefined>) => values.join(" ").toLowerCase().includes(normalized);
    return {
      projects: state.projects
        .filter((project) => includes(project.name, project.description))
        .slice(0, limit)
        .map((project) => compactProject(state, project)),
      members: uniqueProjectMembers(state.projectMembers)
        .filter((member) => includes(member.name, member.email))
        .slice(0, limit),
      tasks: state.tasks
        .filter((task) => includes(task.title, task.notes, task.project, task.tags.join(" ")))
        .slice(0, limit)
        .map((task) => compactTask(state, task)),
    };
  }

  async createProject(input: CreateProjectInput) {
    return this.mutate(undefined, (state, timestamp) => {
      const session = this.session;
      const next = createProjectInState(state, input.name, input.description ?? "", timestamp, uid, {
        accountId: session?.account.id,
        name: session?.account.name,
        email: session?.account.email,
        taskStageMode: input.taskStageMode,
      });
      const created = next.projects.find((project) => !state.projects.some((item) => item.id === project.id));
      if (!created) throw new Error("Project was not created. Check project name.");
      const withDefaults = input.defaultExpectedStartHours === undefined
        ? next
        : updateProjectInState(next, { ...created, defaultExpectedStartHours: Math.max(0, Math.round(input.defaultExpectedStartHours)) }, timestamp);
      return { state: withDefaults, result: compactProject(withDefaults, withDefaults.projects.find((project) => project.id === created.id)!) };
    });
  }

  async updateProject(projectId: string, input: UpdateProjectInput) {
    return this.mutate(projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const nextProject: Project = {
        ...project,
        name: input.name?.trim() || project.name,
        description: input.description ?? project.description,
        defaultExpectedStartHours: input.defaultExpectedStartHours === undefined
          ? project.defaultExpectedStartHours
          : Math.max(0, Math.round(input.defaultExpectedStartHours)),
        taskStageMode: input.taskStageMode ?? project.taskStageMode,
      };
      const next = {
        ...updateProjectInState(state, nextProject, timestamp),
        tasks: state.tasks.map((task) =>
          task.projectId === projectId && input.name?.trim()
            ? { ...task, project: input.name.trim(), updatedAt: timestamp }
            : task,
        ),
      };
      return { state: next, result: compactProject(next, next.projects.find((item) => item.id === projectId)!) };
    });
  }

  async archiveProject(projectId: string) {
    return this.mutate(projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const next = updateProjectInState(state, { ...project, archivedAt: timestamp }, timestamp);
      return { state: next, result: compactProject(next, next.projects.find((item) => item.id === projectId)!) };
    });
  }

  async restoreProject(projectId: string) {
    return this.mutate(projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const next = updateProjectInState(state, { ...project, archivedAt: undefined }, timestamp);
      return { state: next, result: compactProject(next, next.projects.find((item) => item.id === projectId)!) };
    });
  }

  async listMembers(projectId?: string, includeDisabled = false) {
    const state = await this.readState(projectId);
    const members = projectId
      ? state.projectMembers.filter((member) => member.projectId === projectId)
      : uniqueProjectMembers(state.projectMembers);
    return members.filter((member) => includeDisabled || member.status !== "disabled");
  }

  async createMember(input: CreateMemberInput) {
    return this.mutate(input.projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === input.projectId);
      if (!project) throw new Error(`Project not found: ${input.projectId}`);
      const next = addProjectMemberToState(state, input.projectId, input.name, input.email ?? "", input.roles ?? ["executor"], timestamp, uid, {
        accountId: input.accountId,
        workspaceId: project.workspaceId,
      });
      const normalizedEmail = input.email?.trim().toLowerCase();
      const created = next.projectMembers.find(
        (member) =>
          member.projectId === input.projectId &&
          (
            (input.accountId && member.accountId === input.accountId) ||
            (normalizedEmail && member.email?.toLowerCase() === normalizedEmail) ||
            member.name === (input.name.trim() || "新成员")
          ),
      );
      if (!created) throw new Error("Project member was not created. Check member input.");
      return { state: next, result: created };
    });
  }

  async updateMember(projectMemberId: string, input: UpdateMemberInput) {
    return this.mutate(undefined, (state, timestamp) => {
      const member = state.projectMembers.find((item) => item.id === projectMemberId);
      if (!member) throw new Error(`Project member not found: ${projectMemberId}`);
      const nextMember: ProjectMember = {
        ...member,
        name: input.name?.trim() || member.name,
        email: input.email === undefined ? member.email : input.email.trim() || undefined,
        status: input.status ?? member.status ?? "active",
      };
      const next = updateProjectMemberInState(state, nextMember, timestamp);
      return { state: next, result: next.projectMembers.find((item) => item.id === projectMemberId)! };
    });
  }

  async deleteMember(projectMemberId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      if (!state.projectMembers.some((member) => member.id === projectMemberId)) throw new Error(`Project member not found: ${projectMemberId}`);
      return { state: unbindProjectMemberInState(state, projectMemberId, timestamp), result: { deletedProjectMemberId: projectMemberId } };
    });
  }

  async bindMemberToProject(projectId: string, memberRef: string, roles: ProjectMemberRole[] = ["executor"]) {
    return this.mutate(projectId, (state, timestamp) => {
      const project = state.projects.find((item) => item.id === projectId);
      if (!project) throw new Error(`Project not found: ${projectId}`);
      const normalizedRef = memberRef.trim().toLowerCase();
      const source = state.projectMembers.find(
        (member) =>
          member.id === memberRef ||
          member.accountId === memberRef ||
          member.email?.toLowerCase() === normalizedRef,
      );
      if (!source) throw new Error(`Project member source not found: ${memberRef}`);
      const next = addProjectMemberToState(state, projectId, source.name, source.email ?? "", roles, timestamp, uid, {
        accountId: source.accountId,
        workspaceId: project.workspaceId ?? source.workspaceId,
      });
      const projectMember = next.projectMembers.find(
        (member) =>
          member.projectId === projectId &&
          (
            (source.accountId && member.accountId === source.accountId) ||
            (source.email && member.email?.toLowerCase() === source.email.toLowerCase()) ||
            member.name === source.name
          ),
      );
      return { state: next, result: projectMember };
    });
  }

  async updateProjectMember(projectMemberId: string, input: { roles?: ProjectMemberRole[]; status?: "active" | "disabled" }) {
    return this.mutate(undefined, (state, timestamp) => {
      const projectMember = state.projectMembers.find((member) => member.id === projectMemberId);
      if (!projectMember) throw new Error(`Project member not found: ${projectMemberId}`);
      const next = updateProjectMemberInState(state, {
        ...projectMember,
        roles: input.roles ?? projectMember.roles,
        status: input.status ?? projectMember.status ?? "active",
      }, timestamp);
      return { state: next, result: next.projectMembers.find((member) => member.id === projectMemberId)! };
    });
  }

  async unbindProjectMember(projectMemberId: string) {
    return this.mutate(undefined, (state, timestamp) => ({
      state: unbindProjectMemberInState(state, projectMemberId, timestamp),
      result: { unboundProjectMemberId: projectMemberId },
    }));
  }

  async listTasks(filter: TaskListFilter) {
    const state = await this.readState(filter.projectId);
    return sortedByUpdatedAt(state.tasks.filter((task) => taskMatchesFilter(task, filter))).map((task) => compactTask(state, task));
  }

  async getTask(taskId: string) {
    const state = await this.readState();
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const projectMembers = projectMembersForProject(state, task.projectId);
    const workSessions = state.workSessions.filter((session) => session.taskId === taskId);
    return { task, projectMembers, workSessions };
  }

  async getTodayPlan() {
    const state = await this.readState();
    const plan = state.dailyPlans.find((item) => item.date === todayKey());
    const taskIds = new Set(plan?.committedTaskIds ?? []);
    return {
      date: todayKey(),
      plan,
      tasks: state.tasks.filter((task) => taskIds.has(task.id)).map((task) => compactTask(state, task)),
    };
  }

  async getTodayWorkbench(projectId?: string) {
    const state = await this.readState(projectId);
    const plan = state.dailyPlans.find((item) => item.date === todayKey());
    const taskIds = new Set(plan?.committedTaskIds ?? []);
    const todayTasks = state.tasks
      .filter((task) => taskIds.has(task.id))
      .filter((task) => !projectId || task.projectId === projectId)
      .filter((task) => task.status !== "archived" && task.status !== "split");
    const projectMemberIds = new Set(todayTasks.map((task) => task.primaryExecutorMemberId).filter(Boolean) as string[]);
    const members = state.projectMembers.filter((member) => projectMemberIds.has(member.id));
    const activeSessions = activeWorkSessionsForTasks(state, todayTasks);
    const activeTaskIds = new Set(activeSessions.filter((session) => session.status === "active").map((session) => session.taskId));
    const groups = [...members, undefined].map((member) => {
      const tasks = todayTasks.filter((task) => (member ? task.primaryExecutorMemberId === member.id : !task.primaryExecutorMemberId));
      return {
        memberId: member?.id,
        memberName: memberLabel(member),
        taskCount: tasks.length,
        activeTaskCount: tasks.filter((task) => activeTaskIds.has(task.id)).length,
        tasks: tasks.map((task) => ({
          ...compactTask(state, task),
          isActive: activeTaskIds.has(task.id),
        })),
      };
    }).filter((group) => group.taskCount > 0);
    return {
      date: todayKey(),
      projectId,
      totalTaskCount: todayTasks.length,
      activeSessions,
      groups,
    };
  }

  async getActiveWork(projectId?: string) {
    const state = await this.readState(projectId);
    const tasks = state.tasks.filter((task) => !projectId || task.projectId === projectId);
    return activeWorkSessionsForTasks(state, tasks).map((session) => {
      const task = state.tasks.find((item) => item.id === session.taskId);
      const executor = session.executorMemberId ? state.projectMembers.find((member) => member.id === session.executorMemberId) : undefined;
      return {
        ...session,
        task: task ? compactTask(state, task) : undefined,
        executorName: memberLabel(executor),
      };
    });
  }

  async getProjectOverview(projectId: string) {
    const state = await this.readState(projectId);
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) throw new Error(`Project not found: ${projectId}`);
    const tasks = state.tasks.filter((task) => task.projectId === projectId);
    const board = buildProgressBoard(state, projectId);
    return {
      project,
      progressPercent: board.projectProgress,
      activeSessions: board.activeSessions,
      sections: board.sections,
      counts: {
        total: tasks.length,
        pool: tasks.filter((task) => task.status === "pool").length,
        committed: tasks.filter((task) => task.status === "committed").length,
        inProgress: tasks.filter((task) => task.status === "in_progress").length,
        pendingReview: tasks.filter((task) => task.status === "pending_review").length,
        completed: tasks.filter((task) => task.status === "completed").length,
        archived: tasks.filter((task) => task.status === "archived").length,
      },
    };
  }

  async listPendingReviews(projectId?: string) {
    return this.listTasks({ projectId, status: "pending_review", includeArchived: false, includeSplit: false });
  }

  async listRiskTasks(projectId?: string) {
    const state = await this.readState(projectId);
    const projects = projectId
      ? state.projects.filter((project) => project.id === projectId)
      : state.projects.filter((project) => !project.archivedAt);
    return projects.flatMap((project) => {
      const board = buildProgressBoard(state, project.id);
      return board.sections
        .filter((section) => section.kind !== "normal")
        .flatMap((section) =>
          section.tasks.map((task) => ({
            projectId: project.id,
            projectName: project.name,
            riskKind: section.kind,
            riskTitle: section.title,
            ...task,
          })),
        );
    });
  }

  async getDailySummary(date = todayKey()) {
    const state = await this.readState();
    const plan = state.dailyPlans.find((item) => item.date === date);
    const taskIds = new Set(plan?.committedTaskIds ?? []);
    const tasks = state.tasks.filter((task) => taskIds.has(task.id)).map((task) => compactTask(state, task));
    const focusSessions = state.focusSessions.filter((session) => session.startedAt.slice(0, 10) === date);
    const workSessions = state.workSessions.filter((session) => session.startedAt.slice(0, 10) === date);
    return {
      date,
      plan,
      tasks,
      focusSessions,
      workSessions,
      insights: buildInsights(state, date),
    };
  }

  async updateDailyReview(date: string, patch: DailyReviewPatch) {
    return this.mutate(undefined, (state, timestamp) => {
      const { state: withPlan, plan } = ensurePlanInState(state, date, timestamp);
      const nextReview = { ...defaultReview(), ...plan.review, ...patch };
      delete (nextReview as DailyReviewPatch).reflection;
      delete (nextReview as DailyReviewPatch).reviewed;
      const nextPlan: DailyPlan = {
        ...plan,
        reflection: patch.reflection ?? plan.reflection,
        review: nextReview,
        reviewedAt: patch.reviewed === false ? undefined : patch.reviewed ? timestamp : plan.reviewedAt,
        updatedAt: timestamp,
      };
      return {
        state: {
          ...withPlan,
          dailyPlans: withPlan.dailyPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
          updatedAt: timestamp,
        },
        result: nextPlan,
      };
    });
  }

  async createTask(input: CreateTaskInput) {
    return this.mutate(input.projectId, (state, timestamp) => {
      const next = createProjectTaskInState(state, input.projectId, input, timestamp);
      const created = next.tasks.find((task) => !state.tasks.some((item) => item.id === task.id));
      if (!created) throw new Error("Task was not created. Check projectId and title.");
      return { state: next, result: compactTask(next, created) };
    });
  }

  async updateTask(taskId: string, input: UpdateTaskInput) {
    return this.mutate(undefined, (state, timestamp) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      const subtasks = input.subtasks
        ? input.subtasks.map((title) => title.trim()).filter(Boolean).map((title) => ({ id: uid("subtask"), title, completed: false, createdAt: timestamp }))
        : task.subtasks;
      const estimatePomodoros =
        input.estimateHours !== undefined
          ? Math.max(1, Math.ceil((Math.max(0, input.estimateHours) * 60) / Math.max(1, state.settings.focusMinutes)))
          : input.estimatePomodoros !== undefined
            ? Math.max(1, Math.round(input.estimatePomodoros))
            : task.estimatePomodoros;
      const next = {
        ...state,
        tasks: state.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                title: input.title?.trim() || item.title,
                notes: input.notes ?? item.notes,
                tags: input.tags ?? item.tags,
                priority: input.priority ?? item.priority,
                severity: input.severity ?? item.severity,
                stage: input.stage ?? item.stage,
                estimatePomodoros,
                expectedStartAt: input.expectedStartAt ?? item.expectedStartAt,
                expectedFinishAt: input.expectedFinishAt ?? item.expectedFinishAt,
                dueAt: input.dueAt ?? item.dueAt,
                reminderAt: input.reminderAt ?? item.reminderAt,
                repeatRule: input.repeatRule ?? item.repeatRule,
                repeatIntervalDays: input.repeatIntervalDays ?? item.repeatIntervalDays,
                subtasks,
                updatedAt: timestamp,
              }
            : item,
        ),
        updatedAt: timestamp,
      };
      const updated = next.tasks.find((item) => item.id === taskId)!;
      return { state: next, result: compactTask(next, updated) };
    });
  }

  async batchCreateTasks(projectId: string, tasks: Array<Omit<ProjectTaskInput, "projectId"> & { title: string }>) {
    return this.mutate(projectId, (state, timestamp) => {
      let next = state;
      const createdIds: string[] = [];
      for (const input of tasks) {
        const beforeIds = new Set(next.tasks.map((task) => task.id));
        next = createProjectTaskInState(next, projectId, input, timestamp);
        const created = next.tasks.find((task) => !beforeIds.has(task.id));
        if (created) createdIds.push(created.id);
      }
      return {
        state: next,
        result: createdIds.map((id) => compactTask(next, next.tasks.find((task) => task.id === id)!)),
      };
    });
  }

  async batchAssignTasks(taskIds: string[], assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) {
    return this.mutate(assignment.projectId, (state, timestamp) => {
      let next = state;
      for (const taskId of taskIds) {
        next = assignTaskInState(next, taskId, assignment, timestamp);
      }
      return {
        state: next,
        result: taskIds
          .map((taskId) => next.tasks.find((task) => task.id === taskId))
          .filter((task): task is Task => Boolean(task))
          .map((task) => compactTask(next, task)),
      };
    });
  }

  async batchAddTasksToToday(taskIds: string[]) {
    return this.mutate(undefined, (state, timestamp) => {
      let next = state;
      for (const taskId of taskIds) {
        next = addToTodayInState(next, taskId, timestamp);
      }
      return {
        state: next,
        result: {
          date: todayKey(),
          committedTaskIds: next.dailyPlans.find((plan) => plan.date === todayKey())?.committedTaskIds ?? [],
        },
      };
    });
  }

  async splitTask(taskId: string, childTitles: string[]) {
    return this.mutate(undefined, (state, timestamp) => {
      const parent = state.tasks.find((task) => task.id === taskId);
      if (!parent) throw new Error(`Task not found: ${taskId}`);
      const titles = childTitles.map((title) => title.trim()).filter(Boolean);
      if (!titles.length) throw new Error("At least one child task title is required.");
      let next: AppState = {
        ...state,
        tasks: state.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                status: "split" as const,
                progressNote: task.progressNote || "任务已拆分为更小工作项。",
                updatedAt: timestamp,
              }
            : task,
        ),
        dailyPlans: state.dailyPlans.map((plan) =>
          plan.committedTaskIds.includes(taskId)
            ? { ...plan, committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId), updatedAt: timestamp }
            : plan,
        ),
        updatedAt: timestamp,
      };
      const childIds: string[] = [];
      for (const title of titles) {
        const beforeIds = new Set(next.tasks.map((task) => task.id));
        next = createProjectTaskInState(next, parent.projectId, {
          title,
          notes: `由「${parent.title}」拆分而来。`,
          tags: parent.tags,
          priority: parent.priority,
          severity: parent.severity,
          stage: parent.stage,
          estimatePomodoros: Math.max(1, Math.ceil(parent.estimatePomodoros / titles.length)),
          primaryExecutorMemberId: parent.primaryExecutorMemberId,
          collaboratorMemberIds: parent.collaboratorMemberIds,
          dueAt: parent.dueAt,
        }, timestamp);
        const created = next.tasks.find((task) => !beforeIds.has(task.id));
        if (created) childIds.push(created.id);
      }
      return {
        state: next,
        result: {
          parent: compactTask(next, next.tasks.find((task) => task.id === taskId)!),
          children: childIds.map((id) => compactTask(next, next.tasks.find((task) => task.id === id)!)),
        },
      };
    });
  }

  async deleteTask(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      if (!state.tasks.some((task) => task.id === taskId)) throw new Error(`Task not found: ${taskId}`);
      return { state: removeTaskReferences(state, taskId, timestamp), result: { deletedTaskId: taskId } };
    });
  }

  async assignTask(taskId: string, assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] }) {
    return this.mutate(assignment.projectId, (state, timestamp) => {
      const next = assignTaskInState(state, taskId, assignment, timestamp);
      const task = next.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { state: next, result: compactTask(next, task) };
    });
  }

  async setTaskStatus(taskId: string, status: TaskStatus) {
    return this.mutate(undefined, (state, timestamp) => {
      const task = state.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      const next = {
        ...state,
        tasks: state.tasks.map((item) =>
          item.id === taskId
            ? {
                ...item,
                status,
                progressPercent: status === "completed" ? 100 : item.progressPercent,
                completedAt: status === "completed" ? timestamp : item.completedAt,
                updatedAt: timestamp,
              }
            : item,
        ),
        updatedAt: timestamp,
      };
      return { state: next, result: compactTask(next, next.tasks.find((item) => item.id === taskId)!) };
    });
  }

  async updateTaskProgress(taskId: string, progressPercent: number, progressNote = "") {
    return this.mutate(undefined, (state, timestamp) => {
      const next = updateTaskProgressInState(state, taskId, progressPercent, progressNote, timestamp);
      const task = next.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { state: next, result: compactTask(next, task) };
    });
  }

  async addTaskToToday(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = addToTodayInState(state, taskId, timestamp);
      return { state: next, result: { taskId, date: todayKey(), committedTaskIds: next.dailyPlans.find((plan) => plan.date === todayKey())?.committedTaskIds ?? [] } };
    });
  }

  async removeTaskFromToday(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = removeFromTodayInState(state, taskId, timestamp);
      return { state: next, result: { taskId, date: todayKey(), committedTaskIds: next.dailyPlans.find((plan) => plan.date === todayKey())?.committedTaskIds ?? [] } };
    });
  }

  async startTask(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = startWorkSessionInState(state, taskId, timestamp, { source: "mcp" });
      const session = next.workSessions.find((item) => item.taskId === taskId && item.startedAt === timestamp);
      return { state: next, result: { task: compactTask(next, next.tasks.find((item) => item.id === taskId)!), workSession: session } };
    });
  }

  async pauseWorkSession(input: { taskId?: string; workSessionId?: string }) {
    return this.mutate(undefined, (state, timestamp) => ({
      state: pauseWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
      result: { paused: true },
    }));
  }

  async resumeWorkSession(input: { taskId?: string; workSessionId?: string }) {
    return this.mutate(undefined, (state, timestamp) => ({
      state: resumeWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
      result: { resumed: true },
    }));
  }

  async finishWorkSession(input: { taskId?: string; workSessionId?: string }) {
    return this.mutate(undefined, (state, timestamp) => ({
      state: finishWorkSessionState(state, timestamp, input.taskId, input.workSessionId, { source: "mcp" }),
      result: { finished: true },
    }));
  }

  async submitTaskReview(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = submitTaskForReviewInState(state, taskId, actorMemberIdForTask(state, taskId), timestamp);
      const task = next.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { state: next, result: compactTask(next, task) };
    });
  }

  async acceptTaskReview(taskId: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = acceptTaskInState(state, taskId, actorMemberIdForTask(state, taskId), timestamp);
      const task = next.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { state: next, result: compactTask(next, task) };
    });
  }

  async returnTaskReview(taskId: string, reason: string) {
    return this.mutate(undefined, (state, timestamp) => {
      const next = returnTaskForReviewInState(state, taskId, reason, actorMemberIdForTask(state, taskId), timestamp);
      const task = next.tasks.find((item) => item.id === taskId);
      if (!task) throw new Error(`Task not found: ${taskId}`);
      return { state: next, result: compactTask(next, task) };
    });
  }

  async getSyncDiagnostics() {
    const session = await this.ensureSession();
    const state = await this.readState();
    const revisionResponse = await fetch(apiUrl(this.config.serverUrl, "/sync/revision"), {
      headers: authHeaders(session.token),
    });
    const revision = await readResponse<{ current_revision: number }>(revisionResponse);
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
        conflictCount: state.sync.conflicts?.length ?? 0,
      },
      remote: {
        currentRevision: revision.current_revision,
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

export const requireConfirmation = (confirmed: boolean | undefined, action: string) => {
  if (!confirmed) {
    throw new Error(`${action} is high risk. Ask the user for explicit confirmation, then call again with confirmed=true.`);
  }
};
