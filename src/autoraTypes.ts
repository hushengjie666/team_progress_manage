export type AutoraBinding = {
  id: string;
  revision: number;
  workspaceId: string;
  projectId: string;
  label: string;
  enabled: boolean;
  roots: { id: string; kind: string; label: string }[];
};

export type AutoraStatus = {
  mode: "observe" | "analysis";
  codex: { auth: string; permissions: { code: string } };
};

export type AutoraConversation = {
  conversationId: string;
  revision: string;
  source: { revision: string };
};

export type AutoraTurn = {
  turnId: string;
  state: "queued" | "running" | "cancelling" | "completed" | "failed" | "cancelled" | "interrupted_unknown";
  blockedReason: string | null;
  reason: string | null;
  report: string | null;
  truncated?: boolean;
};

export type AutoraMessage = {
  id: string;
  text: string;
  turnId?: string;
};

export type AutoraSession = {
  title: string;
  text: string;
  bindingId: string;
  bindingRevision: number;
  conversation: AutoraConversation;
  messages: AutoraMessage[];
  pending?: {
    clientMessageId: string;
    expectedConversationRevision: string;
    expectedSourceRevision: string;
    text: string;
  };
};
