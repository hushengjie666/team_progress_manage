import { createInitialState } from "./seed";
import { dedupeProjectMembersByIdentity } from "./projectMemberDeduplication";
import { buildTeamDataWorkspace } from "./businessStateWorkspace";
import type {
  AppState,
  DailyPlan,
  ExecutionSignal,
  FocusSession,
  Interruption,
  Project,
  ProjectMember,
  RewardState,
  Task,
  TaskTemplate,
  TemplateInstance,
  WorkSession,
} from "./types";

export type BusinessEntity =
  | "project"
  | "project_member"
  | "task"
  | "daily_plan"
  | "focus_session"
  | "work_session"
  | "execution_signal"
  | "interruption"
  | "reward_state"
  | "task_template"
  | "template_instance";

export type BusinessPayload =
  | Project
  | ProjectMember
  | Task
  | DailyPlan
  | FocusSession
  | WorkSession
  | ExecutionSignal
  | Interruption
  | RewardState
  | TaskTemplate
  | TemplateInstance;

export type BusinessRow = {
  workspace_id?: string;
  account_id?: string;
  entity: BusinessEntity;
  id: string;
  updated_at: string;
  revision?: number;
  payload: BusinessPayload;
};

const templateInstanceId = (instance: TemplateInstance) =>
  `${instance.templateId}_${instance.taskId}`;

const rewardStateId = (state: AppState) =>
  `reward_state_${state.auth.account?.id ?? "local"}`;

export function businessRowsFromState(state: AppState): BusinessRow[] {
  const workspace = buildTeamDataWorkspace(state);
  const currentWorkspaceId = workspace.currentWorkspaceId;
  const ownerAccountId = state.auth.account?.id;
  return [
    ...state.projects.map((project) => ({
      workspace_id: workspace.workspaceIdForPayload(project, currentWorkspaceId),
      entity: "project" as const,
      id: project.id,
      updated_at: project.updatedAt,
      payload: project,
    })),
    ...state.projectMembers.map((member) => ({
      workspace_id: workspace.workspaceIdForPayload(member, workspace.projectWorkspaceId(member.projectId) ?? currentWorkspaceId),
      entity: "project_member" as const,
      id: member.id,
      updated_at: member.updatedAt,
      payload: member,
    })),
    ...state.tasks.map((task) => {
      const workspaceId = workspace.projectWorkspaceId(task.projectId) ?? workspace.workspaceIdForPayload(task, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        entity: "task" as const,
        id: task.id,
        updated_at: task.updatedAt,
        payload: workspaceId && task.workspaceId !== workspaceId ? { ...task, workspaceId } : task,
      };
    }),
    ...state.dailyPlans.map((plan) => {
      const workspaceId = workspace.workspaceIdForPayload(plan, currentWorkspaceId);
      return {
        workspace_id: workspaceId,
        account_id: plan.ownerAccountId ?? ownerAccountId,
        entity: "daily_plan" as const,
        id: plan.id,
        updated_at: plan.updatedAt,
        payload: workspaceId && plan.workspaceId !== workspaceId ? { ...plan, workspaceId } : plan,
      };
    }),
    ...state.focusSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(
        session,
        session.taskId ? workspace.taskWorkspaceId(session.taskId) : currentWorkspaceId,
      ),
      entity: "focus_session" as const,
      id: session.id,
      updated_at: session.endedAt ?? session.startedAt,
      payload: session,
    })),
    ...state.workSessions.map((session) => ({
      workspace_id: workspace.workspaceIdForPayload(session, workspace.taskWorkspaceId(session.taskId) ?? currentWorkspaceId),
      entity: "work_session" as const,
      id: session.id,
      updated_at: session.updatedAt,
      payload: session,
    })),
    ...state.executionSignals.map((signal) => ({
      workspace_id: workspace.workspaceIdForPayload(signal, workspace.taskWorkspaceId(signal.taskId) ?? currentWorkspaceId),
      entity: "execution_signal" as const,
      id: signal.id,
      updated_at: signal.createdAt,
      payload: signal,
    })),
    ...state.interruptions.map((interruption) => ({
      workspace_id: workspace.workspaceIdForPayload(
        interruption,
        interruption.taskId ? workspace.taskWorkspaceId(interruption.taskId) : currentWorkspaceId,
      ),
      entity: "interruption" as const,
      id: interruption.id,
      updated_at: interruption.resolvedAt ?? interruption.createdAt,
      payload: interruption,
    })),
    {
      workspace_id: currentWorkspaceId,
      account_id: ownerAccountId,
      entity: "reward_state",
      id: rewardStateId(state),
      updated_at: state.updatedAt,
      payload: state.rewardState,
    },
    ...state.taskTemplates.map((template) => ({
      workspace_id: currentWorkspaceId,
      entity: "task_template" as const,
      id: template.id,
      updated_at: state.updatedAt,
      payload: template,
    })),
    ...state.templateInstances.map((instance) => ({
      workspace_id: currentWorkspaceId,
      entity: "template_instance" as const,
      id: templateInstanceId(instance),
      updated_at: instance.createdAt,
      payload: instance,
    })),
  ];
}

export function mergeBusinessRowsIntoState(local: AppState, rows: BusinessRow[]): AppState {
  const loadedAt = new Date().toISOString();
  const base = createInitialState();
  const next: AppState = {
    ...base,
    auth: local.auth,
    settings: local.settings,
    backend: {
      ...local.backend,
      status: "ready",
      message: "团队在线数据已加载",
      lastLoadedAt: loadedAt,
      businessRowRevisions: Object.fromEntries(rows.map((row) => [businessRowKey(row), row.revision ?? 0])),
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
    updatedAt: loadedAt,
  };

  for (const row of rows) {
    if (row.entity === "project") next.projects.push(row.payload as Project);
    if (row.entity === "project_member") next.projectMembers.push(row.payload as ProjectMember);
    if (row.entity === "task") next.tasks.push(row.payload as Task);
    if (row.entity === "daily_plan") next.dailyPlans.push(row.payload as DailyPlan);
    if (row.entity === "focus_session") next.focusSessions.push(row.payload as FocusSession);
    if (row.entity === "work_session") next.workSessions.push(row.payload as WorkSession);
    if (row.entity === "execution_signal") next.executionSignals.push(row.payload as ExecutionSignal);
    if (row.entity === "interruption") next.interruptions.push(row.payload as Interruption);
    if (row.entity === "task_template") next.taskTemplates.push(row.payload as TaskTemplate);
    if (row.entity === "template_instance") next.templateInstances.push(row.payload as TemplateInstance);
    if (row.entity === "reward_state" && (!row.account_id || row.account_id === local.auth.account?.id)) {
      next.rewardState = row.payload as RewardState;
    }
  }

  return {
    ...next,
    projectMembers: dedupeProjectMembersByIdentity(next.projectMembers),
  };
}

export const businessRowKey = (row: Pick<BusinessRow, "workspace_id" | "entity" | "id">) =>
  `${row.workspace_id ?? ""}:${row.entity}:${row.id}`;
