import { useCallback, useEffect, useRef, useState } from "react";
import { AutoraApiError, autoraRequest, autoraTurnIsActive } from "../../autoraClient";
import type { AutoraBinding, AutoraConversation, AutoraSession, AutoraStatus, AutoraTurn } from "../../autoraTypes";
import type { Task } from "../../types";

function readSession(key: string, sourceRevision: string): AutoraSession | undefined {
  try {
    const entry = JSON.parse(sessionStorage.getItem(key) ?? "null");
    if (entry?.sourceRevision === sourceRevision && typeof entry.session?.conversation?.conversationId === "string" &&
      Array.isArray(entry.session.messages)) return entry.session;
  } catch { /* A closed or unavailable browser session starts a new discussion. */ }
}

export function useTaskAiConversation(task: Task, ownerId: string) {
  const storageKey = `timemanage.autora.${ownerId}.${task.workspaceId}.${task.projectId}.${task.id}`;
  const [session, setSession] = useState(() => readSession(storageKey, task.updatedAt));
  const sessionRef = useRef(session);
  const [title, setTitle] = useState(session?.title ?? task.title);
  const [text, setText] = useState(session?.text ?? task.notes);
  const [bindingId, setBindingId] = useState(session?.bindingId ?? "");
  const [bindings, setBindings] = useState<AutoraBinding[]>([]);
  const [status, setStatus] = useState<AutoraStatus>();
  const [turns, setTurns] = useState<Record<string, AutoraTurn>>({});
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contextCount, setContextCount] = useState<number>();
  const [contextLimited, setContextLimited] = useState(false);
  const [contextError, setContextError] = useState("");
  const [contextRefresh, setContextRefresh] = useState(0);
  const mounted = useRef(true);
  const lock = useRef(false);
  const binding = bindings.find((item) => item.id === bindingId);
  const activeTurn = Object.values(turns).find(autoraTurnIsActive);
  const waitingForTurn = session?.messages.some((message) => message.turnId && !turns[message.turnId]);
  const sourceChanged = Boolean(session && (session.title !== title.trim() || session.text !== text.trim() ||
    session.bindingId !== bindingId || session.bindingRevision !== binding?.revision));

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const remember = (value: AutoraSession) => {
    sessionRef.current = value;
    try { sessionStorage.setItem(storageKey, JSON.stringify({ sourceRevision: task.updatedAt, session: value })); }
    catch { /* Analysis can continue when browser storage is unavailable. */ }
    if (mounted.current) setSession(value);
  };

  const refresh = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextStatus, result] = await Promise.all([
        autoraRequest<AutoraStatus>("/status"),
        autoraRequest<{ bindings: AutoraBinding[] }>("/bindings"),
      ]);
      if (!mounted.current) return;
      const matches = result.bindings.filter((item) => item.projectId === task.projectId && item.workspaceId === task.workspaceId);
      setStatus(nextStatus);
      setBindings(matches);
      setContextRefresh((value) => value + 1);
      setBindingId((current) => matches.some((item) => item.id === current) ? current : matches.find((item) => item.enabled)?.id ?? "");
    } catch (cause) {
      if (mounted.current) { setStatus(undefined); setError((cause as Error).message); }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [task.projectId, task.workspaceId]);

  useEffect(() => { void refresh(); }, [refresh]);

  useEffect(() => {
    let stopped = false;
    setContextCount(undefined);
    setContextLimited(false);
    setContextError("");
    if (binding?.enabled) {
      autoraRequest<{ files: unknown[]; coverage: string[] }>(`/bindings/${encodeURIComponent(binding.id)}/context`)
        .then((context) => {
          if (stopped) return;
          setContextCount(context.files.length);
          setContextLimited(context.coverage.some((item) => /context_byte_limit|depth_limit|entry_limit/.test(item)));
        })
        .catch((cause: Error) => { if (!stopped) setContextError(cause.message); });
    }
    return () => { stopped = true; };
  }, [binding?.id, binding?.revision, binding?.enabled, contextRefresh]);

  useEffect(() => {
    if (!session?.messages.some((message) => message.turnId)) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const result = await Promise.all(session.messages.filter((message) => message.turnId).map((message) =>
          autoraRequest<AutoraTurn>(`/turns/${encodeURIComponent(message.turnId!)}`)));
        if (stopped) return;
        setTurns(Object.fromEntries(result.map((turn) => [turn.turnId, turn])));
        if (result.some(autoraTurnIsActive)) timer = setTimeout(poll, 1500);
      } catch (cause) {
        if (!stopped) { setError((cause as Error).message); timer = setTimeout(poll, 5000); }
      }
    };
    void poll();
    return () => { stopped = true; clearTimeout(timer); };
  }, [session]);

  const send = async (message: string) => {
    if (lock.current || activeTurn || waitingForTurn || !binding?.enabled || !status || contextCount === undefined || contextError || !title.trim() || !text.trim()) return false;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      let current = sessionRef.current;
      if (!current || (sourceChanged && !current.pending)) {
        const snapshot = await autoraRequest<{ requirementSnapshotId: string }>("/requirements", {
          bindingId, title: title.trim(), text: text.trim(),
        });
        const conversation = await autoraRequest<AutoraConversation>("/conversations", {
          bindingId, expectedBindingRevision: binding.revision, requirementSnapshotId: snapshot.requirementSnapshotId,
        });
        current = { title: title.trim(), text: text.trim(), bindingId, bindingRevision: binding.revision, conversation, messages: [] };
        remember(current);
        setTurns({});
      }
      if (!current.pending) {
        const latest = await autoraRequest<AutoraConversation>(`/conversations/${encodeURIComponent(current.conversation.conversationId)}`);
        current = { ...current, conversation: latest, pending: {
          clientMessageId: crypto.randomUUID(), expectedConversationRevision: latest.revision,
          expectedSourceRevision: latest.source.revision, text: message.trim(),
        } };
        remember(current);
      }
      const pending = current.pending!;
      const receipt = await autoraRequest<{ turnId: string; conversationRevision: string }>(
        `/conversations/${encodeURIComponent(current.conversation.conversationId)}/turns`, pending, pending.clientMessageId,
      );
      remember({ ...current, pending: undefined,
        conversation: { ...current.conversation, revision: receipt.conversationRevision },
        messages: [...current.messages, { id: pending.clientMessageId, text: pending.text, turnId: receipt.turnId }],
      });
      return true;
    } catch (cause) {
      if (cause instanceof AutoraApiError && ["source_changed", "context_changed", "revision_conflict", "recovery_required"].includes(cause.code)) {
        const current = sessionRef.current;
        if (current) remember({ ...current, pending: undefined });
      }
      if (mounted.current) setError((cause as Error).message);
      return false;
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  const newSession = () => {
    if (lock.current || activeTurn || waitingForTurn || session?.pending) return;
    sessionRef.current = undefined;
    setSession(undefined);
    setTurns({});
    setError("");
    try { sessionStorage.removeItem(storageKey); } catch { /* Browser storage is optional. */ }
  };

  const cancel = async () => {
    if (!activeTurn || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      const next = await autoraRequest<AutoraTurn>(`/turns/${encodeURIComponent(activeTurn.turnId)}/cancel`, {});
      if (mounted.current) setTurns((current) => ({ ...current, [next.turnId]: next }));
    } catch (cause) {
      if (mounted.current) setError((cause as Error).message);
    } finally {
      lock.current = false;
      if (mounted.current) setBusy(false);
    }
  };

  return { title, setTitle, text, setText, bindingId, setBindingId, bindings, binding, status, turns,
    session, error, busy, loading, contextCount, contextLimited, contextError, sourceChanged, activeTurn,
    fieldsLocked: busy || Boolean(activeTurn || waitingForTurn || session?.pending),
    canSend: Boolean(status && binding?.enabled && contextCount !== undefined && !contextError && title.trim() && text.trim() && !loading && !busy && !activeTurn && !waitingForTurn),
    refresh, send, cancel, newSession };
}
