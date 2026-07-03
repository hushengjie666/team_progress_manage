import { uid } from "./seed";
import type { Task, TaskTemplate } from "./types";

export const instantiateTemplate = (template: TaskTemplate, timestamp = new Date().toISOString()): Task => ({
  id: uid("task"),
  title: template.name,
  notes: template.description,
  tags: template.tags,
  projectId: "project_starter",
  project: template.project,
  collaboratorMemberIds: [],
  progressPercent: 0,
  progressNote: "",
  priority: template.priority,
  severity: template.severity,
  stage: template.stage ?? "requirements",
  estimatePomodoros: template.estimatePomodoros,
  status: "pool",
  repeatRule: template.repeatRule ?? "none",
  subtasks: template.subtasks.map((title) => ({
    id: uid("subtask"),
    title,
    completed: false,
    createdAt: timestamp,
  })),
  sortOrder: Date.now(),
  actualPomodoros: 0,
  estimateHistory: [],
  createdAt: timestamp,
  updatedAt: timestamp,
});
