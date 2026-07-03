import { createProjectInState, updateProjectInState } from "../../src/teamProgress.js";
import type { Project } from "../../src/types.js";
import { sortedByUpdatedAt } from "../../src/workSessionTransitions.js";
import { uid } from "../../src/seed.js";
import { TimeManageMcpBaseClient } from "./coreBase.js";
import { compactProject, uniqueProjectMembers } from "./coreProjectModel.js";
import { compactTask } from "./coreTaskModel.js";
import type { CreateProjectInput, UpdateProjectInput } from "./coreTypes.js";

export class TimeManageMcpProjectClient extends TimeManageMcpBaseClient {
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
}
