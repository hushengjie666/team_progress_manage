const demoProjectIdSuffix = (projectId: string) => projectId.replace(/[^a-zA-Z0-9_-]/g, "_");

export const demoTaskIdForProject = (taskId: string, projectId: string) => `${taskId}_${demoProjectIdSuffix(projectId)}`;

export const demoEntityIdForProject = (id: string, projectId: string) => `${id}_${demoProjectIdSuffix(projectId)}`;

export const upsertById = <T extends { id: string }>(current: T[], incoming: T[]) => {
  const incomingIds = new Set(incoming.map((item) => item.id));
  return [...incoming, ...current.filter((item) => !incomingIds.has(item.id))];
};

export const appendUnique = (current: string[], incoming: string[]) => [...current, ...incoming.filter((id) => !current.includes(id))];

export const mapDemoTaskId = (taskId: string | undefined, projectId: string) => (taskId ? demoTaskIdForProject(taskId, projectId) : undefined);

export const mapDemoSessionId = (sessionId: string | undefined, projectId: string) =>
  sessionId ? demoEntityIdForProject(sessionId, projectId) : undefined;
