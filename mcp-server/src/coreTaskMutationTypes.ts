export type TaskAssignment = {
  projectId?: string;
  primaryExecutorMemberId?: string;
  collaboratorMemberIds?: string[];
};

export type WorkSessionMutationInput = {
  taskId?: string;
  workSessionId?: string;
};
