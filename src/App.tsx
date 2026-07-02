import {
  Plus,
  ShieldCheck,
  ShieldQuestion,
  TimerReset,
  Search,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateRemaining,
  defaultReview,
  deriveRewardState,
  pauseTimer,
  planCapacityHint,
  planPressure,
  suggestedCapacity,
  suggestedTasks,
  taskSuggestions,
} from "./domain";
import { generateRecurringTask } from "./recurrence";
import { buildProgressBoard } from "./progressBoard";
import { requestTimerNotifications } from "./notifications";
import { checkStrictModeViolation, requestStrictPermissions, saveState, startStrictMode, stopStrictMode } from "./storage";
import {
  createPlatformAccount,
  createWorkspace,
  createSyncEventSource,
  getAuthStatus,
  getSyncRevision,
  loginToSyncServer,
  loginToWorkspace,
  REQUIRED_FULL_RECONCILE_VERSION,
  syncableStateFingerprint,
  updatePlatformAccount,
  type AuthSession,
} from "./sync";
import {
  applyRemoteRevisionReceipt,
  canRunAutoSync,
  clearRemoteSyncDebounce,
  parseSyncRevisionEvent,
  remoteRevisionDelay,
  retryIsWaiting,
  shouldRequestFullReconcile,
  shouldRequestIntervalSync,
  shouldRequestRemoteRevision,
  syncTokenForState,
  withSseStatus,
} from "./syncRuntime";
import { createSyncRequestRuntime } from "./syncRequestRuntime";
import { createDataPortabilityRuntime } from "./dataPortabilityRuntime";
import { demoTaskIdForProject, mergeDemoDataIntoState } from "./demoData";
import { applyTeamStateLoadFailure } from "./appBoot";
import { loadInitialAppState } from "./appBootRuntime";
import { instantiateTemplate, parseQuickInput } from "./planning";
import { runSyncDiagnostics as runSyncDiagnosticsApi } from "./syncDiagnostics";
import { announceTimerEnd, runDueTaskReminders, stopWhiteNoise, syncWhiteNoise, updateActiveTimerPresence } from "./timerRuntime";
import { createKeyboardRuntime } from "./keyboardRuntime";
import {
  applySyncConflictResolution,
  syncConflictResolutionToast,
} from "./conflictResolutionModel";
import {
  addProjectMemberToState,
  acceptTaskInState,
  assignTaskInState,
  createProjectInState,
  reorderProjectsInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectInState,
  updateProjectMemberInState,
  updateTaskProgressInState,
} from "./teamProgress";
import {
  createProjectTaskInState,
  deriveProjectDetailModel,
  initialProjectTaskFilters,
  type ProjectTaskFilters,
  type ProjectTaskInput,
} from "./projectDetail";
import { uid } from "./seed";
import { clearRememberedAuth, readRememberedAuth, saveRememberedAuth } from "./rememberedAuth";
import { resolveMemberForProject, resolveMemberIdForProject } from "./memberIdentity";
import { canManageProjectMembers } from "./accessControl";
import {
  committedTasksForPlan,
  currentMemberForState,
  currentTaskForFocus,
  deriveWorkspaceModel,
  focusTasksForMember,
  poolTasksForFilters,
  taskById,
} from "./workbenchModel";
import { addTaskToTodayInState } from "./workSessionTransitions";
import { getTeamRevision, loadTeamState } from "./teamApi";
import { createTeamStateRuntime } from "./teamStateRuntime";
import {
  createWorkspaceAccountRuntime,
  isSuperAdminAccount,
  loadAuthenticatedWorkspaceSession,
} from "./workspaceAccountRuntime";
import type {
  AppState,
  Account,
  AuthState,
  BlockProfile,
  CoachStepId,
  DailyPlan,
  ImportSummary,
  Interruption,
  InterruptionAction,
  InterruptionType,
  CommandAction,
  ParsedQuickInput,
  Project,
  ProjectInvitation,
  ProjectMember,
  ProjectMemberRole,
  ReportFilter,
  SessionMode,
  SessionOutcome,
  StrictViolation,
  StrictModeStatus,
  SyncConflict,
  SyncDiagnosticResult,
  SyncState,
  Task,
  TaskStageMode,
  TaskTemplate,
  WorkspaceInvitation,
} from "./types";
import { WorkspaceView } from "./components/WorkspaceView";
import { MemberStatusView, ProjectDetailView, type ProjectDetailTab } from "./components/ProjectDetailView";
import { FocusView, MiniTimer } from "./components/FocusView";
import { ConfirmDialog, ShortcutHelpDialog, SplitTaskDialog } from "./components/Dialogs";
import { ReportsView } from "./components/ReportsView";
import { SettingsView, type SettingsSection } from "./components/SettingsView";
import { CalendarView } from "./components/CalendarView";
import { CommandPalette } from "./components/CommandPalette";
import { AuthGate } from "./components/AuthGate";
import { DailyReviewView } from "./components/DailyReviewView";
import { AppTopbar } from "./components/AppTopbar";
import { WorkspaceInvitationMenu } from "./components/WorkspaceInvitationMenu";
import { WorkspaceDirectoryView } from "./components/WorkspaceDirectoryView";
import { createAppNavigation, mobileTitleForNavigation } from "./appNavigation";
import {
  emptyTaskDefaults,
  endSessionInState,
  getTodayPlan,
  ensureTodayPlan,
  initialDraft,
  initialFilters,
  modeLabel,
  formatTime,
  parseDateTimeLocal,
  removeTaskFromTodayInState,
  finishExpiredTimerInState,
  restoreTimerInState,
  shouldFinishExpiredTimerInState,
  startTimerInState,
  taskStageModeOptions,
  today,
  toggleTimerInState,
  nowIso,
  type DeletedTaskSnapshot,
  type SplitDraft,
  type Tab,
  type TaskDraft,
  type TaskFilters,
} from "./appModel";

function shouldShowStrictStatusToast(status: StrictModeStatus) {
  return status.platform !== "browser" || !status.message.includes("浏览器预览已进入软严格模式");
}

const LOCAL_SYNC_DEBOUNCE_MS = 800;
const REMOTE_SYNC_DEBOUNCE_MS = 250;
const REMOTE_SYNC_BUSY_RETRY_MS = 1000;
const REMOTE_REVISION_POLL_MS = 1000;
const LEGACY_SYNC_ENABLED = false;
const TEAM_REVISION_POLL_MS = 1000;
const hasLiveWork = (state: AppState) =>
  Boolean(state.activeTimer) || state.workSessions.some((session) => session.status === "active" || session.status === "paused");

type QuickProjectCreateDraft = {
  name: string;
  description: string;
  workspaceId: string;
  taskStageMode: TaskStageMode;
};

const actorMemberIdForTask = (state: AppState, taskId: string) => {
  const task = state.tasks.find((item) => item.id === taskId);
  return task ? resolveMemberIdForProject(state, task.projectId) : undefined;
};

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("workspace");
  const [workspaceMode, setWorkspaceMode] = useState<"board" | "workbench">("board");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectDetailTab, setProjectDetailTab] = useState<ProjectDetailTab>("overview");
  const [projectTaskFilters, setProjectTaskFilters] = useState<ProjectTaskFilters>(initialProjectTaskFilters);
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [loaded, setLoaded] = useState(false);
  const [strictStatus, setStrictStatus] = useState<StrictModeStatus | null>(null);
  const [toast, setToast] = useState("");
  const [toastVisible, setToastVisible] = useState(false);
  const [quickNote, setQuickNote] = useState("");
  const [syncPassword, setSyncPassword] = useState("");
  const [suppressAutoLogin, setSuppressAutoLogin] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [preferredFocusTaskId, setPreferredFocusTaskId] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(initialFilters);
  const [selectedWorkbenchProjectIds, setSelectedWorkbenchProjectIds] = useState<string[]>([]);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [pendingSplit, setPendingSplit] = useState<SplitDraft | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [deletedTaskSnapshot, setDeletedTaskSnapshot] = useState<DeletedTaskSnapshot | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticResult | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [settingsSection, setSettingsSection] = useState<SettingsSection>("members");
  const [platformAccounts, setPlatformAccounts] = useState<Account[]>([]);
  const [workspaceInvitations, setWorkspaceInvitations] = useState<WorkspaceInvitation[]>([]);
  const [projectInvitations, setProjectInvitations] = useState<ProjectInvitation[]>([]);
  const [quickProjectCreateOpen, setQuickProjectCreateOpen] = useState(false);
  const [quickProjectDraft, setQuickProjectDraft] = useState<QuickProjectCreateDraft>({
    name: "",
    description: "",
    workspaceId: "",
    taskStageMode: "regular",
  });
  const [quickProjectWarning, setQuickProjectWarning] = useState("");
  const stateRef = useRef<AppState | null>(null);
  const pendingImportPayloadRef = useRef<unknown>(null);
  const syncFingerprintRef = useRef<string | null>(null);
  const remoteSyncDebounceRef = useRef<number | null>(null);
  const remoteSyncTargetRevisionRef = useRef(0);
  const strictStartingRef = useRef<Set<string>>(new Set());
  const reminderSentRef = useRef<Set<string>>(new Set());
  const stopNoiseRef = useRef<(() => void) | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const tabRef = useRef<Tab>("workspace");
  const selectedTaskIdRef = useRef<string | null>(null);
  const { persistTeamChanges, commitTeamState } = createTeamStateRuntime({
    getState: () => stateRef.current,
    setState,
    setToast,
  });
  const {
    refreshPlatformAccounts,
    refreshWorkspaceInvitations,
    refreshProjectInvitations,
    inviteWorkspaceMember,
    inviteProjectMember,
    updateWorkspace,
    updateWorkspaceMembership,
    acceptPendingWorkspaceInvitation,
    acceptPendingProjectInvitation,
  } = createWorkspaceAccountRuntime({
    getState: () => stateRef.current,
    setState,
    setToast,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });

  const setAuthPatch = (patch: Partial<AuthState>) => {
    setState((current) =>
      current
        ? {
            ...current,
            auth: { ...current.auth, ...patch },
            updatedAt: nowIso(),
          }
        : current,
    );
  };
  const updateState = (updater: (value: AppState) => AppState) => {
    const current = stateRef.current;
    if (!current) return;
    const next = ensureTodayPlan(updater(current));
    stateRef.current = next;
    commitTeamState(current, next);
  };
  const setSyncStatus = (patch: Partial<SyncState>) => {
    updateState((current) => ({
      ...current,
      sync: { ...current.sync, ...patch, tombstones: patch.tombstones ?? current.sync.tombstones },
    }));
  };
  const {
    requestSync,
    runSync,
    isSyncInFlight,
    clearLocalDebounce,
  } = createSyncRequestRuntime({
    getState: () => stateRef.current,
    setState,
    setSyncStatus,
    setToast,
    remoteSyncTargetRevisionRef,
    localDebounceMs: LOCAL_SYNC_DEBOUNCE_MS,
    enabled: LEGACY_SYNC_ENABLED,
    hasLiveWork,
  });

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!toast) {
      setToastVisible(false);
      return;
    }
    setToastVisible(true);
    const timer = window.setTimeout(() => setToastVisible(false), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(
    () => () => {
      if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    tabRef.current = tab;
  }, [tab]);

  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  useEffect(() => createKeyboardRuntime({
    getState: () => stateRef.current,
    getCurrentTab: () => tabRef.current,
    getSelectedTaskId: () => selectedTaskIdRef.current,
    setCommandPaletteOpen,
    setShowShortcutHelp,
    setSettingsSection,
    setWorkspaceMode,
    setTab,
    setPendingReset,
    setSelectedTaskId,
    completeReview: () => completeReview(),
    beginTimer: (mode, taskId) => beginTimer(mode, taskId),
    toggleTimer: () => toggleTimer(),
    moveCommittedTask: (taskId, direction) => moveCommittedTask(taskId, direction),
  }).attach(), []);

  useEffect(() => {
    loadInitialAppState({ persistTeamChanges })
      .then((result) => {
        setPlatformAccounts(result.platformAccounts);
        setWorkspaceInvitations(result.workspaceInvitations);
        setProjectInvitations(result.projectInvitations);
        if (result.state) setState(result.state);
        if (result.toast) setToast(result.toast);
        setLoaded(true);
      })
      .catch(() => {
        setToast("读取应用缓存失败，已加载默认数据");
      });
  }, []);

  useEffect(() => {
    if (!state || !loaded) return;
    const handle = window.setTimeout(() => {
      saveState(state).catch(() => setToast("保存应用缓存失败，请检查存储权限"));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state, loaded]);

  useEffect(() => {
    const token = state?.auth.token ?? state?.sync.token;
    if (!loaded || !state || !token) return;
    let cancelled = false;
    let inFlight = false;
    const refreshIfNeeded = async () => {
      if (cancelled || inFlight) return;
      const current = stateRef.current;
      const currentToken = current?.auth.token ?? current?.sync.token;
      if (!current || !currentToken) return;
      inFlight = true;
      try {
        const revision = await getTeamRevision(current.sync, currentToken);
        if (cancelled || revision <= current.sync.lastPulledRevision) return;
        const next = await loadTeamState(current);
        if (!cancelled) setState(ensureTodayPlan(next));
      } catch (error) {
        if (!cancelled) setState((value) => (value ? applyTeamStateLoadFailure(value, error) : value));
      } finally {
        inFlight = false;
      }
    };
    const immediate = window.setTimeout(() => void refreshIfNeeded(), TEAM_REVISION_POLL_MS);
    const interval = window.setInterval(() => void refreshIfNeeded(), TEAM_REVISION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [loaded, state?.auth.token, state?.sync.token, state?.sync.serverUrl]);

  useEffect(() => {
    const flushState = () => {
      const current = stateRef.current;
      if (!current) return;
      void saveState(current);
    };
    const flushWhenHidden = () => {
      if (document.visibilityState === "hidden") flushState();
    };
    window.addEventListener("pagehide", flushState);
    document.addEventListener("visibilitychange", flushWhenHidden);
    return () => {
      window.removeEventListener("pagehide", flushState);
      document.removeEventListener("visibilitychange", flushWhenHidden);
    };
  }, []);

  useEffect(() => {
    if (!state?.activeTimer?.isRunning) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.activeTimer?.isRunning) return;
      if (current.sync.status === "syncing") return;
      const nextRemaining = calculateRemaining(current.activeTimer);
      if (nextRemaining > 0) {
        setState({
          ...current,
          activeTimer: { ...current.activeTimer, remaining: nextRemaining },
          updatedAt: nowIso(),
        });
        return;
      }
      const timestamp = nowIso();
      const title = `${modeLabel[current.activeTimer.mode]}已结束`;
      const body =
        current.activeTimer.mode === "focus"
          ? "记录一个番茄，休息一下再继续。"
          : "休息结束，可以回到当下清单。";
      setToast(title);
      announceTimerEnd(current.settings, title, body);
      stopStrictMode().then(setStrictStatus).catch(() => undefined);
      commitTeamState(current, finishExpiredTimerInState(current, timestamp));
    }, 1000);
    return () => window.clearInterval(handle);
  }, [state?.activeTimer?.isRunning]);

  useEffect(() => {
    const handle = () => {
      const current = stateRef.current;
      if (!current?.activeTimer) return;
      if (current.sync.status === "syncing") return;
      const timestamp = nowIso();
      const shouldFinish = shouldFinishExpiredTimerInState(current, timestamp);
      const next = restoreTimerInState(current, timestamp);
      if (shouldFinish) {
        const title = `${modeLabel[current.activeTimer.mode]}已结束`;
        setToast(`${title}，已自动记录`);
        stopStrictMode().then(setStrictStatus).catch(() => undefined);
        commitTeamState(current, next);
        return;
      }
      setState(next);
    };
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("focus", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("focus", handle);
    };
  }, []);

  useEffect(() => {
    const token = syncTokenForState(state);
    if (!state || !canRunAutoSync(state, token)) return;
    const intervalMs = Math.max(30, state.sync.intervalSeconds) * 1000;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      const currentToken = syncTokenForState(current);
      if (!shouldRequestIntervalSync(current, currentToken)) return;
      requestSync("interval", { delayMs: 0 });
    }, intervalMs);
    return () => window.clearInterval(handle);
  }, [state?.sync.enabled, state?.auth.token, state?.sync.token, state?.sync.autoSync, state?.sync.intervalSeconds]);

  const eventSourceToken = syncTokenForState(state);
  useEffect(() => {
    if (!state || !eventSourceToken || !canRunAutoSync(state, eventSourceToken)) return;
    const eventSource = createSyncEventSource(state.sync, eventSourceToken);
    if (!eventSource) return;

    const handleSyncEvent = (event: MessageEvent<string>) => {
      const payload = parseSyncRevisionEvent(event.data);
      if (!payload) return;
      const current = stateRef.current;
      const currentToken = syncTokenForState(current);
      if (!current || !currentToken || !shouldRequestRemoteRevision(current, currentToken, payload.current_revision)) return;
      setState((value) => (value ? applyRemoteRevisionReceipt(value, payload.current_revision, "open") : value));
      requestSync(event.type === "hello" ? "sse-hello" : "sse-revision", {
        targetRevision: payload.current_revision,
        delayMs: remoteRevisionDelay(isSyncInFlight(), current.sync.status, REMOTE_SYNC_BUSY_RETRY_MS, REMOTE_SYNC_DEBOUNCE_MS),
        bypassRetry: true,
      });
    };

    setState((value) => (value ? withSseStatus(value, "connecting") : value));
    eventSource.addEventListener("hello", handleSyncEvent);
    eventSource.addEventListener("revision", handleSyncEvent);
    eventSource.addEventListener("open", () => {
      setState((value) => (value ? withSseStatus(value, "open") : value));
    });
    eventSource.addEventListener("error", () => {
      setState((value) => (value ? withSseStatus(value, "error") : value));
    });
    return () => {
      eventSource.removeEventListener("hello", handleSyncEvent);
      eventSource.removeEventListener("revision", handleSyncEvent);
      eventSource.close();
      clearRemoteSyncDebounce(remoteSyncDebounceRef, remoteSyncTargetRevisionRef, window.clearTimeout);
    };
  }, [state?.sync.enabled, state?.sync.autoSync, state?.sync.serverUrl, state?.sync.deviceId, eventSourceToken]);

  useEffect(() => {
    if (!state || !eventSourceToken || !canRunAutoSync(state, eventSourceToken)) return;
    let cancelled = false;
    let inFlight = false;

    const pollRevision = async () => {
      if (inFlight || cancelled) return;
      const current = stateRef.current;
      const currentToken = syncTokenForState(current);
      if (!current || !currentToken || !canRunAutoSync(current, currentToken)) return;
      if (current.sync.status === "authenticating") return;

      inFlight = true;
      try {
        const revision = await getSyncRevision(current.sync, currentToken);
        if (cancelled) return;
        if (!shouldRequestRemoteRevision(current, currentToken, revision)) return;
        setState((value) => (value ? applyRemoteRevisionReceipt(value, revision) : value));
        requestSync("revision-poll", {
          targetRevision: revision,
          delayMs: remoteRevisionDelay(isSyncInFlight(), current.sync.status, REMOTE_SYNC_BUSY_RETRY_MS, REMOTE_SYNC_DEBOUNCE_MS),
          bypassRetry: true,
        });
      } catch {
        if (!cancelled) {
          setState((value) => (value ? withSseStatus(value, value.sync.sseStatus ?? "error") : value));
        }
      } finally {
        inFlight = false;
      }
    };

    const immediate = window.setTimeout(() => void pollRevision(), REMOTE_REVISION_POLL_MS);
    const interval = window.setInterval(() => void pollRevision(), REMOTE_REVISION_POLL_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(immediate);
      window.clearInterval(interval);
    };
  }, [state?.sync.enabled, state?.sync.autoSync, state?.sync.serverUrl, state?.sync.deviceId, eventSourceToken]);

  useEffect(() => {
    if (!state) return;

    const repaired = ensureTodayPlan(state);
    if (repaired !== state) {
      commitTeamState(state, repaired);
      return;
    }

    const fingerprint = syncableStateFingerprint(state);
    if (syncFingerprintRef.current === null) {
      syncFingerprintRef.current = fingerprint;
      return;
    }
    if (syncFingerprintRef.current === fingerprint) return;
    syncFingerprintRef.current = fingerprint;

    const token = syncTokenForState(state);
    if (!canRunAutoSync(state, token)) return;
    const bypassRetry = hasLiveWork(state);
    if (!bypassRetry && retryIsWaiting(state.sync)) return;
    if (state.sync.status === "authenticating") return;

    requestSync("local-change", { delayMs: LOCAL_SYNC_DEBOUNCE_MS, bypassRetry });
  }, [state]);

  useEffect(() => {
    const token = syncTokenForState(state);
    if (!shouldRequestFullReconcile(loaded, state, token, REQUIRED_FULL_RECONCILE_VERSION)) return;
    requestSync("full-reconcile", { delayMs: 0, bypassRetry: true });
  }, [loaded, state?.sync.enabled, state?.sync.autoSync, state?.sync.lastFullReconcileVersion, state?.auth.token, state?.sync.token]);

  useEffect(() => {
    return () => {
      clearLocalDebounce();
      clearRemoteSyncDebounce(remoteSyncDebounceRef, remoteSyncTargetRevisionRef, window.clearTimeout);
    };
  }, []);

  useEffect(() => {
    syncWhiteNoise(state, stopNoiseRef);
    return () => stopWhiteNoise(stopNoiseRef);
  }, [
    state?.activeTimer?.isRunning,
    state?.activeTimer?.mode,
    state?.settings.soundEnabled,
    state?.settings.whiteNoise,
    state?.settings.whiteNoiseVolume,
  ]);

  useEffect(() => {
    void updateActiveTimerPresence(state?.activeTimer);
  }, [state?.activeTimer?.remaining, state?.activeTimer?.mode, state?.activeTimer?.sessionId]);

  useEffect(() => {
    if (!state?.settings.notificationsEnabled) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current) return;
      runDueTaskReminders(current, reminderSentRef.current, commitTeamState);
    }, 30_000);
    return () => window.clearInterval(handle);
  }, [state?.settings.notificationsEnabled]);

  useEffect(() => {
    const active = state?.activeTimer;
    if (!state || !active || active.mode !== "focus" || !active.isRunning || active.strictStarted || !state.settings.strictModeEnabled) return;
    if (strictStartingRef.current.has(active.sessionId)) return;
    strictStartingRef.current.add(active.sessionId);
    const profile = state.blockProfiles.find((item) => item.id === state.settings.activeBlockProfileId);
    void startStrictMode(profile)
      .then((status) => {
        setStrictStatus(status);
        if (shouldShowStrictStatusToast(status)) setToast(status.message);
        updateState((value) =>
          value.activeTimer?.sessionId === active.sessionId
            ? { ...value, activeTimer: { ...value.activeTimer, strictStarted: status.active } }
            : value,
        );
      })
      .finally(() => {
        strictStartingRef.current.delete(active.sessionId);
      });
  }, [state?.activeTimer?.sessionId, state?.activeTimer?.isRunning, state?.activeTimer?.strictStarted, state?.settings.strictModeEnabled]);

  useEffect(() => {
    if (!state?.activeTimer?.isRunning || state.activeTimer.mode !== "focus" || !state.settings.strictModeEnabled) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.activeTimer || current.activeTimer.mode !== "focus") return;
      if (current.sync.status === "syncing") return;
      const profile = current.blockProfiles.find((item) => item.id === current.settings.activeBlockProfileId);
      void checkStrictModeViolation(profile).then((result) => {
        if (!result.matched || !stateRef.current?.activeTimer) return;
        const now = nowIso();
        const active = stateRef.current.activeTimer;
        const latestProfile = stateRef.current.blockProfiles.find((item) => item.id === stateRef.current?.settings.activeBlockProfileId) ?? profile;
        const recentViolations = stateRef.current.strictViolations.filter((item) => item.sessionId === active.sessionId).length;
        const shouldAbort = latestProfile?.strictness === "locked" && recentViolations >= 3;
        const shouldPause = latestProfile?.strictness === "balanced";
        const violation: StrictViolation = {
          id: uid("strict"),
          workspaceId: active.taskId ? stateRef.current.tasks.find((task) => task.id === active.taskId)?.workspaceId : stateRef.current.auth.workspace?.id,
          sessionId: active.sessionId,
          taskId: active.taskId,
          profileId: latestProfile?.id,
          appName: result.appName,
          url: result.url,
          matchedType: result.matchedType ?? "app",
          matchedValue: result.matchedValue ?? result.appName ?? result.url ?? "未知分心源",
          action: shouldAbort ? "aborted" : shouldPause ? "paused" : "recorded",
          createdAt: now,
        };
        const latest = stateRef.current;
        if (!latest?.activeTimer) return;
        commitTeamState(latest, {
          ...latest,
          strictViolations: [violation, ...latest.strictViolations],
          activeTimer: shouldPause ? pauseTimer(latest.activeTimer, now) : latest.activeTimer,
          updatedAt: now,
        });
        setToast(shouldAbort ? "严格模式连续违规，当前番茄已作废" : `检测到分心源：${violation.matchedValue}`);
        if (shouldAbort) void finishTimer("aborted");
      });
    }, 5_000);
    return () => window.clearInterval(handle);
  }, [state?.activeTimer?.sessionId, state?.activeTimer?.isRunning, state?.settings.strictModeEnabled]);

  const todayPlan = state ? getTodayPlan(state) : null;

  const activeProfile = useMemo(() => {
    if (!state) return undefined;
    return state.blockProfiles.find((profile) => profile.id === state.settings.activeBlockProfileId);
  }, [state]);

  const committedTasks = useMemo(() => {
    if (!state || !todayPlan) return [];
    return committedTasksForPlan(state, todayPlan);
  }, [state, todayPlan]);

  const totalCommittedEstimate = useMemo(
    () => committedTasks.reduce((sum, task) => sum + task.estimatePomodoros, 0),
    [committedTasks],
  );

  const currentMember = useMemo(() => {
    if (!state) return undefined;
    return currentMemberForState(state);
  }, [state]);

  const focusCommittedTasks = useMemo(() => {
    if (!state) return [];
    return focusTasksForMember(state, committedTasks, currentMember);
  }, [state, committedTasks, currentMember]);

  useEffect(() => {
    if (!preferredFocusTaskId) return;
    const preferredTask = focusCommittedTasks.find((task) => task.id === preferredFocusTaskId);
    if (
      !preferredTask ||
      (preferredTask.status !== "committed" && preferredTask.status !== "in_progress" && preferredTask.status !== "pending_review")
    ) {
      setPreferredFocusTaskId(null);
    }
  }, [focusCommittedTasks, preferredFocusTaskId]);

  const poolTasks = useMemo(() => {
    if (!state || !todayPlan) return [];
    return poolTasksForFilters(state, todayPlan, taskFilters);
  }, [state, todayPlan, taskFilters]);

  const workspaceModel = useMemo(() => {
    if (!state || !todayPlan) return null;
    return deriveWorkspaceModel(state, todayPlan, totalCommittedEstimate, committedTasks, poolTasks, selectedWorkbenchProjectIds);
  }, [state, todayPlan, totalCommittedEstimate, committedTasks, poolTasks, selectedWorkbenchProjectIds]);

  useEffect(() => {
    setSelectedWorkbenchProjectIds([]);
  }, [workspaceModel?.currentMember?.id]);

  useEffect(() => {
    setSelectedWorkbenchProjectIds((current) => {
      const available = new Set(workspaceModel?.availableWorkbenchProjectIds ?? []);
      const next = current.filter((projectId) => available.has(projectId));
      return next.length === current.length ? current : next;
    });
  }, [workspaceModel?.availableWorkbenchProjectIds.join("|")]);

  const toggleWorkbenchProject = (projectId: string) => {
    setSelectedWorkbenchProjectIds((current) => {
      return current.includes(projectId)
        ? current.filter((item) => item !== projectId)
        : [...current, projectId];
    });
  };

  const currentTask = useMemo(() => {
    if (!state) return undefined;
    return currentTaskForFocus(state, focusCommittedTasks, preferredFocusTaskId);
  }, [state, focusCommittedTasks, preferredFocusTaskId]);

  const selectedTask = useMemo(() => {
    if (!state) return undefined;
    return taskById(state, selectedTaskId);
  }, [state, selectedTaskId]);

  const primaryProjectId = state?.projects[0]?.id ?? "";
  const activeProjectId = selectedProjectId && state?.projects.some((project) => project.id === selectedProjectId)
    ? selectedProjectId
    : primaryProjectId;
  const projectDetailDate = today();
  const projectDetailModel = useMemo(() => {
    if (!state || !activeProjectId) return undefined;
    return deriveProjectDetailModel(state, activeProjectId, projectTaskFilters, projectDetailDate);
  }, [state, activeProjectId, projectTaskFilters, projectDetailDate]);
  const currentProjectMemberId = useMemo(() => {
    if (!state || !activeProjectId) return undefined;
    return resolveMemberIdForProject(state, activeProjectId);
  }, [state, activeProjectId]);

  if (!state || !todayPlan || !workspaceModel) {
    return (
      <main className="boot">
        <div className="boot-mark">
          <TimerReset size={36} />
        </div>
        <p>正在加载 TimeManage...</p>
      </main>
    );
  }

  const currentProjectId = state.projects[0]?.id ?? "project_starter";

  const addTask = (projectId?: string) => {
    const title = draft.title.trim();
    if (!title) {
      setToast("先写一个任务名称");
      return;
    }
    const timestamp = nowIso();
    const targetProject = projectId
      ? state.projects.find((project) => project.id === projectId) ?? state.projects[0]
      : state.projects[0];
    const taskProjectId = targetProject?.id ?? currentProjectId;
    const task: Task = {
      id: uid("task"),
      workspaceId: targetProject?.workspaceId ?? state.auth.workspace?.id,
      title,
      notes: draft.notes.trim(),
      tags: draft.tags
        .split(/[,\s，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      projectId: taskProjectId,
      project: projectId ? (targetProject?.name ?? draft.project.trim()) || "Inbox" : draft.project.trim() || "Inbox",
      creatorMemberId: resolveMemberIdForProject(state, taskProjectId),
      priority: draft.priority,
      severity: draft.severity,
      stage: draft.stage,
      estimatePomodoros: Math.max(0, Math.round(draft.estimatePomodoros)),
      status: "pool",
      ...emptyTaskDefaults(timestamp, Date.now()),
      dueAt: parseDateTimeLocal(draft.dueAt),
      reminderAt: parseDateTimeLocal(draft.reminderAt),
      repeatRule: draft.repeatRule,
      repeatIntervalDays:
        draft.repeatRule === "interval" || draft.repeatRule === "after_completion"
          ? Math.max(1, Math.round(draft.repeatIntervalDays))
          : undefined,
    };
    updateState((value) => ({ ...value, tasks: [task, ...value.tasks], updatedAt: timestamp }));
    setDraft(initialDraft);
    setToast(task.estimatePomodoros > 7 ? "已添加，但建议拆分这个大任务" : "任务已进入活动清单");
  };

  const createProjectTask = (projectId: string, input: ProjectTaskInput) => {
    const timestamp = nowIso();
    updateState((value) => createProjectTaskInState(value, projectId, input, timestamp));
    setToast("项目任务已创建");
  };

  const commitTask = (taskId: string) => {
    updateState((value) => {
      return addTaskToTodayInState(value, taskId, nowIso());
    });
    setToast("已加入工作队列");
  };

  const removeCommittedTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => {
      return removeTaskFromTodayInState(value, taskId, timestamp);
    });
  };

  const completeTask = (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    if (task.status === "pending_review") {
      setToast("该任务已提交验收，等待项目负责人确认");
      return;
    }
    if (task.status === "completed") {
      setToast("任务已完成，无需重复提交");
      return;
    }
    if (task.status === "pool") {
      setToast("请先加入工作队列或开始执行后再提交验收");
      return;
    }
    if (task.status === "split" || task.status === "archived") {
      setToast("当前状态不能提交验收");
      return;
    }
    const timestamp = nowIso();
    updateState((value) => submitTaskForReviewInState(value, taskId, actorMemberIdForTask(value, taskId), timestamp));
    setPreferredFocusTaskId(taskId);
    setToast("已提交验收，等待项目负责人确认");
  };

  const acceptTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => {
      const acceptedState = acceptTaskInState(value, taskId, actorMemberIdForTask(value, taskId), timestamp);
      const acceptedTask = acceptedState.tasks.find((task) => task.id === taskId && task.status === "completed");
      const recurringTask = acceptedTask ? generateRecurringTask(acceptedTask, timestamp) : null;
      const nextState = {
        ...acceptedState,
        tasks: recurringTask ? [...acceptedState.tasks, recurringTask] : acceptedState.tasks,
        updatedAt: timestamp,
      };
      return {
        ...nextState,
        rewardState: deriveRewardState(nextState, timestamp),
      };
    });
    setSelectedTaskId((current) => (current === taskId ? null : current));
    setToast("验收通过，任务已完成");
  };

  const returnTaskForReview = (taskId: string, reason: string) => {
    const timestamp = nowIso();
    updateState((value) => returnTaskForReviewInState(value, taskId, reason, actorMemberIdForTask(value, taskId), timestamp));
    setToast("已退回任务并记录原因");
  };

  const deleteTask = (taskId: string) => {
    const target = state.tasks.find((task) => task.id === taskId);
    if (target) setPendingDeleteTask(target);
  };

  const confirmDeleteTask = () => {
    if (!pendingDeleteTask) return;
    const taskId = pendingDeleteTask.id;
    const timestamp = nowIso();
    const committedPlanIds = state.dailyPlans.filter((plan) => plan.committedTaskIds.includes(taskId)).map((plan) => plan.id);
    const snapshot: DeletedTaskSnapshot = { task: pendingDeleteTask, committedPlanIds, deletedAt: timestamp };
    updateState((value) => ({
      ...value,
      tasks: value.tasks.filter((task) => task.id !== taskId),
      dailyPlans: value.dailyPlans.map((plan) => ({
        ...plan,
        committedTaskIds: plan.committedTaskIds.filter((id) => id !== taskId),
      })),
      sync: {
        ...value.sync,
        tombstones: [
          ...(value.sync.tombstones ?? []).filter((item) => !(item.entity === "task" && item.id === taskId)),
          { entity: "task", id: taskId, workspaceId: pendingDeleteTask.workspaceId, deletedAt: timestamp },
        ],
      },
      updatedAt: timestamp,
    }));
    if (selectedTaskId === taskId) setSelectedTaskId(null);
    setPendingDeleteTask(null);
    setDeletedTaskSnapshot(snapshot);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    undoTimerRef.current = window.setTimeout(() => setDeletedTaskSnapshot(null), 8_000);
    setToast("任务已删除，可在 8 秒内撤销");
  };

  const undoDeleteTask = () => {
    if (!deletedTaskSnapshot) return;
    const { task, committedPlanIds } = deletedTaskSnapshot;
    const timestamp = nowIso();
    updateState((value) => ({
      ...value,
      tasks: value.tasks.some((item) => item.id === task.id) ? value.tasks : [task, ...value.tasks],
      dailyPlans: value.dailyPlans.map((plan) =>
        committedPlanIds.includes(plan.id) && !plan.committedTaskIds.includes(task.id)
          ? { ...plan, committedTaskIds: [...plan.committedTaskIds, task.id], updatedAt: timestamp }
          : plan,
      ),
      sync: {
        ...value.sync,
        tombstones: (value.sync.tombstones ?? []).filter((item) => !(item.entity === "task" && item.id === task.id)),
      },
      updatedAt: timestamp,
    }));
    setSelectedTaskId(task.id);
    setDeletedTaskSnapshot(null);
    if (undoTimerRef.current) window.clearTimeout(undoTimerRef.current);
    setToast("已撤销删除");
  };

  const beginTimer = async (mode: SessionMode, taskId?: string) => {
    const timestamp = nowIso();
    const sessionId = uid("session");
    if (mode === "focus" && taskId) setPreferredFocusTaskId(taskId);
    updateState((value) => {
      return startTimerInState(value, mode, taskId, timestamp, activeProfile?.id, sessionId);
    });

    if (mode === "focus" && state.settings.strictModeEnabled) {
      strictStartingRef.current.add(sessionId);
      const status = await startStrictMode(activeProfile);
      setStrictStatus(status);
      if (shouldShowStrictStatusToast(status)) setToast(status.message);
      updateState((value) =>
        value.activeTimer?.sessionId === sessionId
          ? { ...value, activeTimer: { ...value.activeTimer, strictStarted: status.active } }
          : value,
      );
      strictStartingRef.current.delete(sessionId);
    } else {
      setToast(`${modeLabel[mode]}已开始`);
    }
  };

  const toggleTimer = () => {
    const timestamp = nowIso();
    updateState((value) => toggleTimerInState(value, timestamp));
  };

  const resetTimer = () => {
    if (state.activeTimer) setPendingReset(true);
  };

  const confirmResetTimer = () => {
    const timestamp = nowIso();
    updateState((value) =>
      value.activeTimer
        ? {
            ...value,
            activeTimer: {
              ...value.activeTimer,
              remaining: value.activeTimer.duration,
              isRunning: false,
              pausedAt: timestamp,
              plannedEndAt: new Date(new Date(timestamp).getTime() + value.activeTimer.duration * 1000).toISOString(),
              pendingSettlement: undefined,
            },
            updatedAt: timestamp,
          }
        : value,
    );
    setPendingReset(false);
    setToast("当前计时已重置");
  };

  const finishTimer = async (outcome: SessionOutcome) => {
    updateState((value) => endSessionInState(value, outcome));
    const status = await stopStrictMode();
    setStrictStatus(status);
    setToast(outcome === "completed" ? "番茄已记录" : "当前番茄已作废");
  };

  const addInterruption = (type: InterruptionType, action: InterruptionAction = "defer") => {
    const active = state.activeTimer;
    const timestamp = nowIso();
    const interruption: Interruption = {
      id: uid("interrupt"),
      workspaceId: active?.taskId ? state.tasks.find((task) => task.id === active.taskId)?.workspaceId : state.auth.workspace?.id,
      sessionId: active?.sessionId,
      taskId: active?.taskId,
      type,
      note: quickNote.trim() || (type === "internal" ? "突然想做其他事" : "外部请求/消息打断"),
      action,
      createdAt: timestamp,
    };
    updateState((value) => ({
      ...value,
      interruptions: [interruption, ...value.interruptions],
      focusSessions: active
        ? value.focusSessions.map((session) =>
            session.id === active.sessionId
              ? {
                  ...session,
                  interruptionCounts: {
                    ...session.interruptionCounts,
                    [type]: session.interruptionCounts[type] + 1,
                  },
                }
              : session,
          )
        : value.focusSessions,
      updatedAt: timestamp,
    }));
    setQuickNote("");
    setToast(type === "internal" ? "已记录内部中断，继续当前番茄" : "已记录外部中断，稍后答复");
  };

  const resolveInterruption = (interruptionId: string) => {
    const timestamp = nowIso();
    updateState((value) => ({
      ...value,
      interruptions: value.interruptions.map((item) =>
        item.id === interruptionId ? { ...item, resolvedAt: timestamp } : item,
      ),
      updatedAt: timestamp,
    }));
  };

  const convertInterruptionToTask = (interruptionId: string) => {
    const source = state.interruptions.find((item) => item.id === interruptionId);
    if (!source) return;
    const timestamp = nowIso();
    const task: Task = {
      id: uid("task"),
      workspaceId: source.workspaceId ?? state.projects.find((project) => project.id === currentProjectId)?.workspaceId ?? state.auth.workspace?.id,
      title: source.note,
      notes: "由中断收件箱转入活动清单。",
      tags: [source.type === "internal" ? "内部中断" : "外部中断"],
      projectId: currentProjectId,
      project: "Inbox",
      creatorMemberId: resolveMemberIdForProject(state, currentProjectId),
      priority: source.type === "external" ? "high" : "medium",
      severity: "medium",
      stage: "requirements",
      estimatePomodoros: 1,
      status: "pool",
      ...emptyTaskDefaults(timestamp, Date.now()),
    };
    updateState((value) => ({
      ...value,
      tasks: [task, ...value.tasks],
      interruptions: value.interruptions.map((item) =>
        item.id === interruptionId ? { ...item, convertedTaskId: task.id, resolvedAt: timestamp } : item,
      ),
      updatedAt: timestamp,
    }));
    setToast("中断已转为活动清单任务");
  };

  const updateReflection = (reflection: string) => {
    updateState((value) => {
      const plan = getTodayPlan(value);
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id ? { ...item, reflection, updatedAt: nowIso() } : item,
        ),
        updatedAt: nowIso(),
      };
    });
  };

  const updateReview = (patch: Partial<DailyPlan["review"]>) => {
    updateState((value) => {
      const plan = getTodayPlan(value);
      const review = { ...defaultReview(), ...plan.review, ...patch };
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id ? { ...item, review, reflection: review.wins || item.reflection, updatedAt: nowIso() } : item,
        ),
        updatedAt: nowIso(),
      };
    });
  };

  const completeReview = () => {
    const timestamp = nowIso();
    updateState((value) => {
      const plan = getTodayPlan(value);
      const nextPlan = {
        ...plan,
        reviewedAt: timestamp,
        suggestedCapacityPomodoros: suggestedCapacity(value),
        suggestedTaskIds: suggestedTasks(value),
        updatedAt: timestamp,
      };
      const nextState = {
        ...value,
        dailyPlans: value.dailyPlans.map((item) => (item.id === plan.id ? nextPlan : item)),
        updatedAt: timestamp,
      };
      return {
        ...nextState,
        rewardState: deriveRewardState(nextState, timestamp),
      };
    });
    setToast("日终回顾已完成，明日容量建议已更新");
  };

  const updateSettings = <K extends keyof AppState["settings"]>(key: K, value: AppState["settings"][K]) => {
    updateState((current) => ({
      ...current,
      settings: { ...current.settings, [key]: value },
      rewardState:
        key === "focusMinutes"
          ? current.rewardState
          : {
              ...current.rewardState,
              dailyGoal: key === "activeBlockProfileId" ? current.rewardState.dailyGoal : current.rewardState.dailyGoal,
            },
      updatedAt: nowIso(),
    }));
  };

  const updateProfile = (profile: BlockProfile) => {
    updateState((value) => ({
      ...value,
      blockProfiles: value.blockProfiles.map((item) => (item.id === profile.id ? profile : item)),
      updatedAt: nowIso(),
    }));
  };

  const createProject = (name: string, description: string, workspaceId?: string, taskStageMode: TaskStageMode = "regular") => {
    const projectName = name.trim();
    if (!projectName) {
      setToast("项目名称不能为空");
      return;
    }
    const timestamp = nowIso();
    updateState((value) =>
      createProjectInState(value, projectName, description, timestamp, uid, {
        accountId: value.auth.account?.id,
        name: value.auth.account?.name,
        email: value.auth.account?.email,
        workspaceId: workspaceId || value.auth.workspace?.id,
        taskStageMode,
      }),
    );
    setToast("项目已创建");
  };

  const updateProject = (project: Project) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectInState(value, project, timestamp));
  };

  const reorderProjects = (projectIds: string[]) => {
    const timestamp = nowIso();
    updateState((value) => reorderProjectsInState(value, projectIds, timestamp));
  };

  const createAccount = (name: string, email: string, password = "1234") => {
    const source = stateRef.current ?? state;
    const token = source.auth.token ?? source.sync.token;
    const normalizedEmail = email.trim().toLowerCase();
    if (!isSuperAdminAccount(source.auth.account)) {
      setToast("只有超级管理员可以创建平台账号");
      return;
    }
    if (!token) {
      setToast("请先登录后台后再创建平台账号");
      return;
    }
    if (!name.trim() || !normalizedEmail || !password.trim()) {
      setToast("请填写账号姓名、登录邮箱或手机号和初始密码");
      return;
    }
    void createPlatformAccount(source.sync, token, {
      name: name.trim(),
      email: normalizedEmail,
      password,
      status: "active",
    })
      .then(() => refreshPlatformAccounts(source))
      .then(() => setToast("平台账号已创建，可在工作区或项目中授权使用"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号创建失败");
      });
  };

  const canManageProjectMembersForProject = (source: AppState, projectId: string) => {
    if (isSuperAdminAccount(source.auth.account)) return true;
    return canManageProjectMembers(source, projectId);
  };

  const updateAccount = (account: Account) => {
    const source = stateRef.current ?? state;
    if (!isSuperAdminAccount(source.auth.account)) {
      setToast("只有超级管理员可以修改平台账号");
      return;
    }
    const normalizedEmail = account.email.trim().toLowerCase();
    const normalizedName = account.name.trim();
    if (!normalizedName) {
      setToast("请输入成员姓名");
      return;
    }
    if (!normalizedEmail) {
      setToast("请输入登录邮箱或手机号");
      return;
    }
    const token = source.auth.token ?? source.sync.token;
    if (platformAccounts.some((item) => item.id !== account.id && item.email.trim().toLowerCase() === normalizedEmail)) {
      setToast("该登录邮箱或手机号已存在于平台账号库，请勿重复使用");
      return;
    }
    if (!token) {
      setToast("请先登录后台后再修改平台账号");
      return;
    }
    void updatePlatformAccount(source.sync, token, account.id, { name: normalizedName, email: normalizedEmail })
      .then(() => refreshPlatformAccounts(source))
      .then(() => setToast("平台账号资料已保存"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号资料保存失败");
      });
  };

  const disableAccount = (accountId: string) => {
    const source = stateRef.current ?? state;
    if (!isSuperAdminAccount(source.auth.account)) {
      setToast("只有超级管理员可以停用平台账号");
      return;
    }
    const account = platformAccounts.find((item) => item.id === accountId);
    if (!account) return;
    if (account.id === source.auth.account?.id) {
      setToast("不能删除当前登录账号");
      return;
    }
    const confirmed = window.confirm(`确定停用平台账号「${account.name}」吗？停用后该账号将无法登录系统。`);
    if (!confirmed) return;
    const token = source.auth.token ?? source.sync.token;
    if (!token) {
      setToast("请先登录后台后再停用平台账号");
      return;
    }
    void updatePlatformAccount(source.sync, token, account.id, { status: "disabled" })
      .then(() => refreshPlatformAccounts(source))
      .then(() => setToast("平台账号已停用"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号停用失败");
      });
  };

  const bindAccessibleMemberToProject = (
    projectId: string,
    input: {
      accountId?: string;
      name: string;
      email?: string;
      workspaceId?: string;
      roles: ProjectMemberRole[];
    },
  ) => {
    const timestamp = nowIso();
    updateState((value) =>
      addProjectMemberToState(value, projectId, input.name, input.email ?? "", input.roles, timestamp, uid, {
        accountId: input.accountId,
        workspaceId: input.workspaceId,
      }),
    );
    setToast("项目成员绑定已更新");
  };

  const updateProjectMember = (member: ProjectMember) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectMemberInState(value, member, timestamp));
  };

  const updateAccountPassword = (account: Account, password: string) => {
    const source = stateRef.current ?? state;
    if (!isSuperAdminAccount(source.auth.account)) {
      setToast("只有超级管理员可以修改平台账号密码");
      return;
    }
    const token = source.auth.token ?? source.sync.token;
    if (!token) {
      setToast("请先登录后台后再修改平台账号密码");
      return;
    }
    if (!password.trim()) {
      setToast("请输入新密码");
      return;
    }
    void updatePlatformAccount(source.sync, token, account.id, { password })
      .then(() => refreshPlatformAccounts(source))
      .then(() => setToast("平台账号密码已更新"))
      .catch((error) => {
        setToast(error instanceof Error ? error.message : "平台账号密码更新失败");
      });
  };

  const updateTask = (taskId: string, updater: Partial<Task> | ((task: Task) => Task)) => {
    const timestamp = nowIso();
    updateState((value) => ({
      ...value,
      tasks: value.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const nextTask = typeof updater === "function" ? updater(task) : { ...task, ...updater };
        return { ...nextTask, updatedAt: timestamp };
      }),
      updatedAt: timestamp,
    }));
  };

  const updateTaskAssignment = (
    taskId: string,
    assignment: { projectId?: string; primaryExecutorMemberId?: string; collaboratorMemberIds?: string[] },
  ) => {
    const timestamp = nowIso();
    updateState((value) => assignTaskInState(value, taskId, assignment, timestamp));
  };

  const updateTaskProgress = (taskId: string, progressPercent: number, progressNote: string) => {
    const timestamp = nowIso();
    updateState((value) => updateTaskProgressInState(value, taskId, progressPercent, progressNote, timestamp));
  };

  const moveCommittedTask = (taskId: string, direction: -1 | 1) => {
    updateState((value) => {
      const plan = getTodayPlan(value);
      const index = plan.committedTaskIds.indexOf(taskId);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= plan.committedTaskIds.length) return value;
      const committedTaskIds = [...plan.committedTaskIds];
      [committedTaskIds[index], committedTaskIds[nextIndex]] = [committedTaskIds[nextIndex], committedTaskIds[index]];
      const timestamp = nowIso();
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id ? { ...item, committedTaskIds, updatedAt: timestamp } : item,
        ),
        updatedAt: timestamp,
      };
    });
  };

  const updatePlanCapacity = (capacityPomodoros: number) => {
    const timestamp = nowIso();
    updateState((value) => {
      const plan = getTodayPlan(value);
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id
            ? { ...item, capacityPomodoros: Math.max(1, Math.round(capacityPomodoros)), updatedAt: timestamp }
            : item,
        ),
        updatedAt: timestamp,
      };
    });
  };

  const generateTodayPlan = () => {
    const timestamp = nowIso();
    updateState((value) => {
      const plan = getTodayPlan(value);
      const existingIds = new Set(plan.committedTaskIds);
      const pressure = planPressure(value, plan);
      const availableCapacity = Math.max(1, plan.capacityPomodoros - pressure.totalEstimate);
      let used = 0;
      const selectedIds: string[] = [];
      for (const suggestion of taskSuggestions(value, plan.date, 8)) {
        const task = value.tasks.find((item) => item.id === suggestion.taskId);
        if (!task || existingIds.has(task.id) || suggestion.action !== "commit") continue;
        if (used > 0 && used + task.estimatePomodoros > availableCapacity) continue;
        selectedIds.push(task.id);
        used += Math.max(1, task.estimatePomodoros);
      }
      const nextIds = Array.from(new Set([...plan.committedTaskIds, ...selectedIds]));
      return {
        ...value,
        tasks: value.tasks.map((task) =>
          selectedIds.includes(task.id) && task.status === "pool"
            ? { ...task, status: "committed" as const, updatedAt: timestamp }
            : task,
        ),
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id
            ? { ...item, committedTaskIds: nextIds, suggestedTaskIds: selectedIds, updatedAt: timestamp }
            : item,
        ),
        updatedAt: timestamp,
      };
    });
    setToast("已根据容量生成今日建议");
  };

  const dismissCoachStep = (stepId: CoachStepId) => {
    updateSettings("dismissedCoachSteps", Array.from(new Set([...(state.settings.dismissedCoachSteps ?? []), stepId])));
  };

  const splitTask = (taskId: string) => {
    const task = state.tasks.find((item) => item.id === taskId);
    if (!task) return;
    const partCount = Math.min(Math.max(2, task.estimatePomodoros), 8);
    const template = Array.from({ length: partCount }, (_, index) => `${task.title} ${index + 1}`).join("\n");
    setPendingSplit({ task, text: template });
  };

  const confirmSplitTask = () => {
    if (!pendingSplit) return;
    const task = pendingSplit.task;
    const titles = pendingSplit.text
      .split(/[\n,，]+/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (titles.length < 2) {
      setToast("至少需要两个子任务标题");
      return;
    }

    const timestamp = nowIso();
    const estimatePerTask = Math.max(1, Math.ceil(task.estimatePomodoros / titles.length));
    const newTasks: Task[] = titles.map((title, index) => ({
      id: uid("task"),
      workspaceId: task.workspaceId,
      title,
      notes: `由「${task.title}」拆分而来。`,
      tags: task.tags,
      projectId: task.projectId,
      project: task.project,
      creatorMemberId: resolveMemberIdForProject(state, task.projectId) ?? task.creatorMemberId,
      primaryExecutorMemberId: task.primaryExecutorMemberId,
      collaboratorMemberIds: task.collaboratorMemberIds ?? [],
      expectedStartAt: task.expectedStartAt,
      expectedFinishAt: task.expectedFinishAt,
      progressPercent: 0,
      progressNote: "",
      priority: task.priority,
      severity: task.severity,
      stage: task.stage,
      estimatePomodoros: estimatePerTask,
      status: task.status === "committed" || todayPlan.committedTaskIds.includes(task.id) ? "committed" : "pool",
      ...emptyTaskDefaults(timestamp, task.sortOrder + index + 1),
      dueAt: task.dueAt,
      reminderAt: index === 0 ? task.reminderAt : undefined,
      repeatRule: task.repeatRule,
      repeatIntervalDays: task.repeatIntervalDays,
    }));

    updateState((value) => {
      const currentPlan = getTodayPlan(value);
      return {
        ...value,
        tasks: [
          ...newTasks.map((item) => ({
            ...item,
            status: task.status === "committed" || currentPlan.committedTaskIds.includes(task.id) ? ("committed" as const) : item.status,
          })),
          ...value.tasks.map((item) =>
            item.id === task.id
              ? {
                  ...item,
                  status: "split" as const,
                  notes: [
                    item.notes,
                    `已拆分为：${titles.join("、")}。`,
                  ].filter(Boolean).join("\n"),
                  updatedAt: timestamp,
                }
              : item,
          ),
        ],
        dailyPlans: value.dailyPlans.map((plan) => ({
          ...plan,
          committedTaskIds: plan.committedTaskIds.flatMap((id) => (id === task.id ? newTasks.map((item) => item.id) : [id])),
          updatedAt: plan.committedTaskIds.includes(task.id) ? timestamp : plan.updatedAt,
        })),
        updatedAt: timestamp,
      };
    });
    setSelectedTaskId(task.id);
    setPendingSplit(null);
    setToast(`已拆分为 ${newTasks.length} 个子任务`);
  };

  const askPermissions = async () => {
    const status = await requestStrictPermissions();
    setStrictStatus(status);
    if (activeProfile) {
      updateProfile({ ...activeProfile, platformPermissionState: status.permission_state, updatedAt: nowIso() });
    }
    setToast(status.message);
  };

  const askNotificationPermissions = async () => {
    const status = await requestTimerNotifications();
    updateState((value) => ({
      ...value,
      settings: {
        ...value.settings,
        notificationsEnabled: status.permission_state !== "denied" && status.permission_state !== "unavailable",
        notificationSettings: {
          permissionState: status.permission_state,
          lastCheckedAt: nowIso(),
        },
      },
      updatedAt: nowIso(),
    }));
    setToast(status.message);
  };

  const updateSyncSetting = <K extends keyof SyncState>(key: K, value: SyncState[K]) => {
    updateState((current) => ({
      ...current,
      sync: { ...current.sync, [key]: value },
      updatedAt: nowIso(),
    }));
  };

  const checkAuthStatus = async () => {
    setAuthPatch({ status: "checking", message: "正在检查后台服务" });
    const source = stateRef.current;
    if (!source) return;
    try {
      const status = await getAuthStatus(source.sync.serverUrl);
      setAuthPatch({
        status: source.auth.token ? "authenticated" : "signed_out",
        bootstrapped: status.bootstrapped,
        message: "请使用管理员分配的账号登录",
      });
    } catch (error) {
      setAuthPatch({
        status: "error",
        message: error instanceof Error ? `认证服务不可用：${error.message}` : "认证服务不可用",
      });
    }
  };

  const applySession = async (session: AuthSession, message: string, options: { resetRuntime?: boolean } = {}) => {
    const source = stateRef.current ?? state;
    if (!source) throw new Error("应用状态尚未加载");
    const loaded = await loadAuthenticatedWorkspaceSession(source, session, message, options);
    setPlatformAccounts(loaded.platformAccounts);
    setWorkspaceInvitations(loaded.workspaceInvitations);
    setProjectInvitations(loaded.projectInvitations);
    setState(loaded.state);
  };

  const handleCreateWorkspace = async (workspaceName?: string, options: { returnTo?: Tab } = {}) => {
    const source = stateRef.current ?? state;
    const token = source?.auth.token;
    if (!source || !token) return;
    const name = workspaceName ?? window.prompt("协作工作区名称") ?? "";
    if (!name.trim()) return;
    setAuthPatch({ status: "checking", message: "正在创建协作工作区" });
    try {
      const session = await createWorkspace(source.sync, token, name.trim());
      setSelectedTaskId(null);
      setPreferredFocusTaskId(null);
      setWorkspaceMode("board");
      if (options.returnTo) {
        setTab(options.returnTo);
      } else if (workspaceName !== undefined) {
        setTab("workspaces");
      } else {
        setTab("workspace");
      }
      await applySession(session, `已创建 ${session.workspace.name}`, { resetRuntime: true });
      setToast(`已创建 ${session.workspace.name}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "创建工作区失败";
      setAuthPatch({ status: "error", message });
      setToast(message);
    }
  };

  const handleWorkspaceLogin = async (email: string, password: string, remember = true) => {
    setAuthPatch({ status: "checking", message: "正在登录账号" });
    try {
      const source = stateRef.current ?? state;
      if (!source) throw new Error("应用状态尚未加载");
      const session = await loginToWorkspace(source.sync, email, password);
      if (remember) saveRememberedAuth(source.sync.serverUrl, session.account.email, password);
      else clearRememberedAuth(source.sync.serverUrl);
      setSuppressAutoLogin(false);
      await applySession(session, `已登录 ${session.workspace.name}`);
      setToast("账号已登录");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录失败";
      setAuthPatch({ status: "error", message });
      setToast(message);
    }
  };

  const handleSyncLogin = async () => {
    setSyncStatus({ status: "authenticating", message: "正在登录团队后台" });
    try {
      const nextSync = await loginToSyncServer(state.sync, syncPassword);
      updateState((current) => ({
        ...current,
        sync: { ...nextSync, retryCount: 0, nextRetryAt: undefined },
        updatedAt: nowIso(),
      }));
      setToast("团队后台已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录团队后台失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const checkSyncHealth = async () => {
    setSyncStatus({ status: "syncing", message: "正在检查团队后台健康状态" });
    try {
      const healthUrl = new URL("/health", state.sync.serverUrl.endsWith("/") ? state.sync.serverUrl : `${state.sync.serverUrl}/`).toString();
      const response = await fetch(healthUrl);
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      setSyncStatus({ status: state.sync.token ? "synced" : "idle", message: `团队后台可访问：${healthUrl}` });
      setToast("团队后台健康检查通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "团队后台健康检查失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const handleSyncNow = async () => {
    await runSync(true);
  };

  const {
    exportJson,
    exportCsv,
    previewImportFile,
    confirmImport,
    restoreBackup,
  } = createDataPortabilityRuntime({
    getState: () => stateRef.current,
    pendingImportPayloadRef,
    setImportSummary,
    setToast,
    commitTeamState,
  });

  const runSyncDiagnostics = async () => {
    setSyncStatus({ status: "syncing", message: "正在运行后台诊断" });
    try {
      const { result, state: diagnosedState } = await runSyncDiagnosticsApi(state, syncPassword);
      setSyncDiagnostic(result);
      setState(ensureTodayPlan(diagnosedState));
      setToast(result.lastError ? `诊断完成：${result.lastError}` : "后台诊断通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "后台诊断失败";
      setSyncDiagnostic({
        checkedAt: nowIso(),
        serverUrl: state.sync.serverUrl,
        conflictCount: state.sync.conflictCount,
        lastError: message,
        steps: [],
      });
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const resolveSyncConflict = (conflict: SyncConflict, action: "local" | "remote" | "later") => {
    if (action === "later") {
      setToast("冲突已保留，稍后可在高级状态继续处理");
      return;
    }
    const timestamp = nowIso();
    updateState((value) => applySyncConflictResolution(value, conflict, action, timestamp));
    setToast(syncConflictResolutionToast(action));
  };

  const instantiateTaskTemplate = (template: TaskTemplate) => {
    const timestamp = nowIso();
    const task = instantiateTemplate(template, timestamp);
    updateState((value) => ({
      ...value,
      tasks: [task, ...value.tasks],
      templateInstances: [{ templateId: template.id, taskId: task.id, createdAt: timestamp }, ...value.templateInstances],
      updatedAt: timestamp,
    }));
    setSelectedTaskId(task.id);
    setTab("workspace");
    setToast(`已从模板生成「${task.title}」`);
  };

  const saveTaskTemplate = (template: TaskTemplate) => {
    const normalized: TaskTemplate = {
      ...template,
      name: template.name.trim() || "未命名模板",
      project: template.project.trim() || "Inbox",
      tags: template.tags.map((tag) => tag.trim()).filter(Boolean),
      stage: template.stage ?? "requirements",
      estimatePomodoros: Math.max(1, Math.round(template.estimatePomodoros)),
      subtasks: template.subtasks.map((item) => item.trim()).filter(Boolean),
    };
    updateState((value) => ({
      ...value,
      taskTemplates: value.taskTemplates.some((item) => item.id === normalized.id)
        ? value.taskTemplates.map((item) => (item.id === normalized.id ? normalized : item))
        : [normalized, ...value.taskTemplates],
      updatedAt: nowIso(),
    }));
    setToast("任务模板已保存");
  };

  const deleteTaskTemplate = (templateId: string) => {
    updateState((value) => ({
      ...value,
      taskTemplates: value.taskTemplates.filter((item) => item.id !== templateId),
      updatedAt: nowIso(),
    }));
    setToast("任务模板已删除");
  };

  const scheduleTaskForDate = (date: string, taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => {
      const existing = value.dailyPlans.find((plan) => plan.date === date);
      const plan: DailyPlan =
        existing ??
        {
          id: `plan_${date}`,
          date,
          capacityPomodoros: value.rewardState.dailyGoal,
          committedTaskIds: [],
          completedPomodoros: 0,
          recommendedCapacityPomodoros: value.rewardState.dailyGoal,
          suggestedCapacityPomodoros: value.rewardState.dailyGoal,
          suggestedTaskIds: [],
          overloadAcknowledged: false,
          reflection: "",
          review: defaultReview(),
          createdAt: timestamp,
          updatedAt: timestamp,
        };
      const nextPlan = {
        ...plan,
        committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
        updatedAt: timestamp,
      };
      return {
        ...value,
        tasks: value.tasks.map((task) => (task.id === taskId && task.status === "pool" ? { ...task, status: "committed", updatedAt: timestamp } : task)),
        dailyPlans: existing ? value.dailyPlans.map((item) => (item.id === nextPlan.id ? nextPlan : item)) : [nextPlan, ...value.dailyPlans],
        updatedAt: timestamp,
      };
    });
    setToast("任务已排入日历计划");
  };

  const addParsedQuickTask = (parsed: ParsedQuickInput) => {
    const timestamp = nowIso();
    const task: Task = {
      id: uid("task"),
      workspaceId: state.projects.find((project) => project.id === currentProjectId)?.workspaceId ?? state.auth.workspace?.id,
      title: parsed.title,
      notes: "由命令面板自然语言快捷添加。",
      tags: parsed.tags,
      projectId: currentProjectId,
      project: parsed.project ?? "Inbox",
      creatorMemberId: resolveMemberIdForProject(state, currentProjectId),
      priority: parsed.priority ?? "medium",
      severity: "medium",
      stage: "requirements",
      estimatePomodoros: parsed.estimatePomodoros,
      status: "pool",
      ...emptyTaskDefaults(timestamp, Date.now()),
      dueAt: parsed.dueAt,
    };
    updateState((value) => ({ ...value, tasks: [task, ...value.tasks], updatedAt: timestamp }));
    setSelectedTaskId(task.id);
    setWorkspaceMode("workbench");
    setTab("workspace");
    setToast(`已添加：${task.title}`);
  };

  const runCommand = (action: CommandAction, parsed?: ParsedQuickInput, taskId?: string) => {
    if (action === "navigate_workspace") openBoard();
    if (action === "navigate_focus") openWorkbench();
    if (action === "navigate_calendar") setTab("calendar");
    if (action === "navigate_daily") setTab("daily");
    if (action === "navigate_reports") setTab("reports");
    if (action === "navigate_settings") {
      setSettingsSection("members");
      setTab("settings");
    }
    if (action === "open_sync_settings") {
      setSettingsSection("sync");
      setTab("settings");
    }
    if (action === "add_quick_task") addParsedQuickTask(parsed ?? parseQuickInput(""));
    if (action === "open_task" && taskId) {
      setSelectedTaskId(taskId);
      setWorkspaceMode("workbench");
      setTab("workspace");
    }
    if (action === "start_focus") {
      setTab("focus");
      void beginTimer("focus", currentTask?.id ?? committedTasks[0]?.id);
    }
    if (action === "toggle_timer" && state.activeTimer) toggleTimer();
    if (action === "record_internal_interruption") addInterruption("internal", "defer");
    if (action === "record_external_interruption") addInterruption("external", "inbox");
    if (action === "open_shortcut_help") setShowShortcutHelp(true);
    setCommandPaletteOpen(false);
  };

  const updateReportFilter = (filter: ReportFilter) => {
    updateSettings("reportFilter", filter);
  };

  const loadDemoData = async () => {
    const current = stateRef.current;
    const targetProjectId =
      current && selectedProjectId && current.projects.some((project) => project.id === selectedProjectId)
        ? selectedProjectId
        : current?.projects[0]?.id;
    if (!current || !targetProjectId) {
      setToast("没有可加载演示数据的项目");
      return;
    }
    const token = current.auth.token ?? current.sync.token;
    if (!token) {
      setToast("请先登录团队后台后再加载演示数据");
      return;
    }
    setToast("正在写入团队后台...");
    try {
      const next = ensureTodayPlan(mergeDemoDataIntoState(current, targetProjectId, nowIso()));
      const saved = await persistTeamChanges(current, next, { refreshAfterSave: true });
      if (!saved) return;
      setSelectedProjectId(targetProjectId);
      setProjectDetailTab("overview");
      setSelectedTaskId(demoTaskIdForProject("demo_task_today_deep", targetProjectId));
      setTaskFilters(initialFilters);
      setTab("project");
      setToast("已将演示数据写入团队后台");
    } catch (error) {
      const failed = applyTeamStateLoadFailure(current, error);
      setState(failed);
      setToast(failed.auth.message);
    }
  };

  const capacityHint = planCapacityHint(state);
  const isSuperAdmin = isSuperAdminAccount(state.auth.account);
  const canManageMembers = isSuperAdmin;
  const canManageActiveProjectMembers = activeProjectId ? canManageProjectMembersForProject(state, activeProjectId) : false;
  const settingsDataSummary = {
    projectCount: state.projects.length,
    taskCount: state.tasks.length,
    projectMemberCount: state.projectMembers.length,
    focusSessionCount: state.focusSessions.length,
    workSessionCount: state.workSessions.length,
    executionSignalCount: state.executionSignals.length,
    interruptionCount: state.interruptions.length,
  };
  const activeNavKey = tab === "workspace" ? workspaceMode : tab === "workspaces" ? "workspaces" : tab === "project" ? "board" : tab === "settings" ? "admin" : tab;
  const openAdmin = (section: SettingsSection = "members") => {
    setSettingsSection(section);
    setTab("settings");
  };
  const openProjectDetail = (projectId: string, detailTab: ProjectDetailTab = "overview") => {
    setSelectedProjectId(projectId);
    setProjectDetailTab(detailTab);
    setSelectedTaskId(null);
    setTab("project");
  };
  const openBoard = () => {
    setWorkspaceMode("board");
    setTab("workspace");
  };
  const openWorkspaces = () => {
    setTab("workspaces");
  };
  const openWorkbench = () => {
    setWorkspaceMode("workbench");
    setTab("workspace");
  };
  const openDailyReview = () => {
    setTab("daily");
  };

  const logout = () => {
    setSuppressAutoLogin(true);
    setPlatformAccounts([]);
    setWorkspaceInvitations([]);
    setProjectInvitations([]);
    updateState((value) => ({
      ...value,
      auth: {
        status: "signed_out",
        bootstrapped: true,
        message: "已退出登录",
      },
      sync: {
        ...value.sync,
        token: undefined,
        enabled: false,
        message: "已退出团队工作区",
      },
      updatedAt: nowIso(),
    }));
    setToast("已退出登录");
  };
  const activeProject = state.projects.find((project) => project.id === activeProjectId);
  const visibleWorkspaces = state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : []);
  const defaultQuickProjectWorkspaceId =
    visibleWorkspaces.find((workspace) => workspace.type === "private")?.id ?? visibleWorkspaces[0]?.id ?? "";
  const workspaceOptionLabel = (workspace: typeof visibleWorkspaces[number]) =>
    `${workspace.type === "private" ? "私人" : "协作"} · ${workspace.name}`;
  const openQuickProjectCreate = () => {
    setQuickProjectDraft({
      name: "",
      description: "",
      workspaceId: defaultQuickProjectWorkspaceId,
      taskStageMode: "regular",
    });
    setQuickProjectWarning("");
    setQuickProjectCreateOpen(true);
  };
  const closeQuickProjectCreate = () => {
    setQuickProjectCreateOpen(false);
    setQuickProjectWarning("");
  };
  const submitQuickProjectCreate = () => {
    const name = quickProjectDraft.name.trim();
    if (!name) {
      setQuickProjectWarning("项目名称不能为空");
      return;
    }
    const workspaceId = quickProjectDraft.workspaceId || defaultQuickProjectWorkspaceId;
    if (!workspaceId) {
      setQuickProjectWarning("当前账号没有可用工作区");
      return;
    }
    createProject(name, quickProjectDraft.description, workspaceId, quickProjectDraft.taskStageMode);
    closeQuickProjectCreate();
  };
  const { topbarNavItems, mobileNavItems, mobileMoreItems } = createAppNavigation({
    openBoard,
    openWorkspaces,
    openMemberStatus: () => setTab("member_status"),
    openWorkbench,
    openFocus: () => setTab("focus"),
    openDailyReview,
    openReports: () => setTab("reports"),
    openCalendar: () => setTab("calendar"),
    openAdmin: () => openAdmin(),
    logout,
  });
  const { title: mobileTitle, subtitle: mobileSubtitle } = mobileTitleForNavigation({ tab, activeNavKey, activeProject });
  const rememberedAuth = readRememberedAuth(state.sync.serverUrl);

  if (state.auth.status !== "authenticated" || !state.auth.token) {
    return (
      <AuthGate
        status={state.auth.status}
        serverUrl={state.sync.serverUrl}
        message={state.auth.message}
        initialEmail={rememberedAuth?.email}
        initialPassword={rememberedAuth?.password}
        autoLogin={Boolean(rememberedAuth?.email && rememberedAuth.password) && !suppressAutoLogin}
        updateServerUrl={(serverUrl) => updateSyncSetting("serverUrl", serverUrl)}
        checkStatus={checkAuthStatus}
        login={handleWorkspaceLogin}
      />
    );
  }

  return (
    <main className="app-shell">
      <section className="main-panel">
        <AppTopbar
          navItems={topbarNavItems}
          mobileNavItems={mobileNavItems}
          mobileMoreItems={mobileMoreItems}
          activeNavKey={activeNavKey}
          mobileTitle={mobileTitle}
          mobileSubtitle={mobileSubtitle}
          actions={(
            <>
              <WorkspaceInvitationMenu
                workspaceInvitations={workspaceInvitations}
                projectInvitations={projectInvitations}
                acceptWorkspaceInvitation={acceptPendingWorkspaceInvitation}
                acceptProjectInvitation={acceptPendingProjectInvitation}
                refreshInvitations={() => {
                  void refreshWorkspaceInvitations();
                  void refreshProjectInvitations();
                }}
              />
              <button className="secondary-button" onClick={logout}>
                账号：{state.auth.account?.name ?? "退出"}
              </button>
              <button className="icon-button" title="命令面板" onClick={() => setCommandPaletteOpen(true)}>
                <Search size={18} />
              </button>
              <button className="icon-button" title="严格模式权限" onClick={askPermissions}>
                {strictStatus?.permission_state === "granted" ? <ShieldCheck size={18} /> : <ShieldQuestion size={18} />}
              </button>
            </>
          )}
          mobileActions={(
            <>
              <WorkspaceInvitationMenu
                workspaceInvitations={workspaceInvitations}
                projectInvitations={projectInvitations}
                acceptWorkspaceInvitation={acceptPendingWorkspaceInvitation}
                acceptProjectInvitation={acceptPendingProjectInvitation}
                refreshInvitations={() => {
                  void refreshWorkspaceInvitations();
                  void refreshProjectInvitations();
                }}
              />
              <button className="secondary-button account-chip" onClick={() => setTab("workspaces")} type="button">
                工作区
              </button>
              <button className="secondary-button account-chip" onClick={logout}>
                {state.auth.account?.name ?? "账号"}
              </button>
              <button className="icon-button" title="命令面板" onClick={() => setCommandPaletteOpen(true)}>
                <Search size={18} />
              </button>
            </>
          )}
        />
        {toast && toastVisible && (
          <div className="global-toast" role="status" aria-live="polite">
            {toast}
          </div>
        )}

        {quickProjectCreateOpen && (
          <div className="modal-backdrop" role="presentation" onMouseDown={closeQuickProjectCreate}>
            <section
              className="modal-panel quick-project-create-modal"
              role="dialog"
              aria-modal="true"
              aria-label="新增项目"
              onMouseDown={(event) => event.stopPropagation()}
            >
              <div className="modal-heading">
                <div>
                  <p className="eyebrow">Project</p>
                  <h2>新增项目</h2>
                  <span>选择项目所属工作区，创建后仍停留在项目总览。</span>
                </div>
                <button className="icon-button" onClick={closeQuickProjectCreate} aria-label="关闭" type="button">
                  <X size={18} />
                </button>
              </div>
              <form
                className="quick-project-create-form"
                onSubmit={(event) => {
                  event.preventDefault();
                  submitQuickProjectCreate();
                }}
              >
                <label>
                  项目名称
                  <input
                    value={quickProjectDraft.name}
                    aria-invalid={Boolean(quickProjectWarning && !quickProjectDraft.name.trim())}
                    onChange={(event) => {
                      setQuickProjectDraft({ ...quickProjectDraft, name: event.target.value });
                      if (quickProjectWarning) setQuickProjectWarning("");
                    }}
                    placeholder="例如：客户交付项目"
                    autoFocus
                  />
                  {quickProjectWarning && <span className="field-error">{quickProjectWarning}</span>}
                </label>
                <label>
                  所属工作区
                  <select
                    value={quickProjectDraft.workspaceId || defaultQuickProjectWorkspaceId}
                    onChange={(event) => setQuickProjectDraft({ ...quickProjectDraft, workspaceId: event.target.value })}
                  >
                    {visibleWorkspaces.map((workspace) => (
                      <option key={workspace.id} value={workspace.id}>{workspaceOptionLabel(workspace)}</option>
                    ))}
                  </select>
                </label>
                <label>
                  项目类型
                  <select
                    value={quickProjectDraft.taskStageMode}
                    onChange={(event) => setQuickProjectDraft({ ...quickProjectDraft, taskStageMode: event.target.value as TaskStageMode })}
                  >
                    {taskStageModeOptions.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </label>
                <label>
                  项目说明
                  <textarea
                    value={quickProjectDraft.description}
                    onChange={(event) => setQuickProjectDraft({ ...quickProjectDraft, description: event.target.value })}
                    placeholder="这个项目要达成什么"
                  />
                </label>
                <div className="modal-actions">
                  <button className="secondary-button" onClick={closeQuickProjectCreate} type="button">
                    取消
                  </button>
                  <button className="primary-button" disabled={!visibleWorkspaces.length} type="submit">
                    <Plus size={16} />
                    添加项目
                  </button>
                </div>
              </form>
            </section>
          </div>
        )}

        {tab === "workspace" && (
          <WorkspaceView
            mode={workspaceMode}
            model={workspaceModel}
            draft={draft}
            setDraft={setDraft}
            addTask={addTask}
            selectedWorkbenchProjectIds={selectedWorkbenchProjectIds}
            toggleWorkbenchProject={toggleWorkbenchProject}
            goalLabel={state.onboarding.desiredHabit}
            todayCapacityPomodoros={todayPlan.capacityPomodoros}
            activeTimer={state.activeTimer}
            projects={state.projects}
            projectMembers={state.projectMembers}
            selectedTask={selectedTask}
            commitTask={commitTask}
            removeCommittedTask={removeCommittedTask}
            completeTask={completeTask}
            deleteTask={deleteTask}
            selectTask={setSelectedTaskId}
            updateTask={updateTask}
            updateTaskAssignment={updateTaskAssignment}
            updateTaskProgress={updateTaskProgress}
            acceptTask={acceptTask}
            returnTaskForReview={returnTaskForReview}
            moveCommittedTask={moveCommittedTask}
            updatePlanCapacity={updatePlanCapacity}
            generateTodayPlan={generateTodayPlan}
            dismissCoachStep={dismissCoachStep}
            splitTask={splitTask}
            beginFocus={(taskId) => {
              setTab("focus");
              void beginTimer("focus", taskId);
            }}
            reorderProjects={reorderProjects}
            openProjectCreate={openQuickProjectCreate}
            openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
            resolveInterruption={resolveInterruption}
            convertInterruptionToTask={convertInterruptionToTask}
          />
        )}

        {tab === "workspaces" && (
          <WorkspaceDirectoryView
            projects={state.projects}
            workspaces={visibleWorkspaces}
            workspaceMemberships={state.auth.workspaceMemberships ?? (state.auth.membership ? [state.auth.membership] : [])}
            currentAccount={state.auth.account}
            projectCards={workspaceModel.projectOverviewCards}
            createWorkspace={(name) => void handleCreateWorkspace(name, { returnTo: "workspaces" })}
            updateWorkspace={updateWorkspace}
            updateWorkspaceMembership={updateWorkspaceMembership}
            inviteWorkspaceMember={inviteWorkspaceMember}
            createProject={createProject}
            updateProject={updateProject}
            openProjectDetail={(projectId) => openProjectDetail(projectId, "overview")}
          />
        )}

        {tab === "member_status" && (
          <MemberStatusView
            state={state}
            selectTask={setSelectedTaskId}
          />
        )}

        {tab === "project" && activeProjectId && (
          <ProjectDetailView
            model={projectDetailModel}
            filters={projectTaskFilters}
            setFilters={setProjectTaskFilters}
            allProjects={state.projects}
            allProjectMembers={state.projectMembers}
            availableWorkspaces={state.auth.workspaces ?? (state.auth.workspace ? [state.auth.workspace] : [])}
            currentProjectMemberId={currentProjectMemberId}
            activeTab={projectDetailTab}
            setActiveTab={setProjectDetailTab}
            selectedTask={selectedTask}
            selectTask={setSelectedTaskId}
            createProjectTask={createProjectTask}
            updateProject={updateProject}
            updateTask={updateTask}
            updateTaskAssignment={updateTaskAssignment}
            updateTaskProgress={updateTaskProgress}
            acceptTask={acceptTask}
            returnTaskForReview={returnTaskForReview}
            splitTask={splitTask}
            beginFocus={(taskId) => {
              setTab("focus");
              void beginTimer("focus", taskId);
            }}
            bindAccessibleMemberToProject={bindAccessibleMemberToProject}
            inviteProjectMember={(input) => {
              const source = stateRef.current ?? state;
              if (!canManageProjectMembersForProject(source, input.projectId)) {
                setToast("只有工作区管理员或项目负责人可以维护项目成员");
                return;
              }
              inviteProjectMember(input);
            }}
            updateProjectMember={updateProjectMember}
            canManageProjectMembers={canManageActiveProjectMembers}
            backToBoard={() => {
              setWorkspaceMode("board");
              setTab("workspace");
            }}
            backToAdmin={() => setTab("workspaces")}
            openMemberSettings={() => openAdmin("members")}
          />
        )}

        {tab === "focus" && (
          <FocusView
            state={state}
            currentTask={currentTask}
            committedTasks={focusCommittedTasks}
            beginTimer={beginTimer}
            toggleTimer={toggleTimer}
            resetTimer={resetTimer}
            finishTimer={finishTimer}
            addInterruption={addInterruption}
            completeTask={completeTask}
          />
        )}

        {tab === "calendar" && (
          <CalendarView
            state={state}
            mode={state.settings.calendarViewMode ?? "week"}
            setMode={(mode) => updateSettings("calendarViewMode", mode)}
            instantiateTaskTemplate={instantiateTaskTemplate}
            saveTaskTemplate={saveTaskTemplate}
            deleteTaskTemplate={deleteTaskTemplate}
            scheduleTaskForDate={scheduleTaskForDate}
            openTask={(taskId) => {
              setSelectedTaskId(taskId);
              setTab("workspace");
            }}
          />
        )}

        {tab === "daily" && (
          <DailyReviewView
            state={state}
            todayPlan={todayPlan}
            capacityHint={capacityHint}
            updateReflection={updateReflection}
            updateReview={updateReview}
            completeReview={completeReview}
          />
        )}

        {tab === "reports" && (
          <ReportsView
            state={state}
            onNavigate={setTab}
            updateReportFilter={updateReportFilter}
            onOpenTask={(taskId) => {
              setSelectedTaskId(taskId);
              setTab("workspace");
            }}
            onFilterProject={(project) =>
              updateReportFilter({
                ...(state.settings.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" }),
                project,
              })
            }
            onFilterTag={(tag) =>
              updateReportFilter({
                ...(state.settings.reportFilter ?? { range: "30d", project: "all", tag: "all", taskId: "all" }),
                tag,
              })
            }
          />
        )}

        {tab === "settings" && (
          <SettingsView
            projectMembers={state.projectMembers}
            accounts={platformAccounts}
            settings={state.settings}
            onboarding={state.onboarding}
            sync={state.sync}
            backupSnapshots={state.backupSnapshots}
            nativeCapabilities={state.nativeCapabilities}
            dataSummary={settingsDataSummary}
            activeSection={settingsSection}
            setActiveSection={setSettingsSection}
            activeProfile={activeProfile}
            strictStatus={strictStatus}
            updateSettings={updateSettings}
            createAccount={createAccount}
            updateAccount={updateAccount}
            updateAccountPassword={updateAccountPassword}
            disableAccount={disableAccount}
            canManageMembers={canManageMembers}
            updateProfile={updateProfile}
            askPermissions={askPermissions}
            askNotificationPermissions={askNotificationPermissions}
            syncPassword={syncPassword}
            setSyncPassword={setSyncPassword}
            updateSyncSetting={updateSyncSetting}
            checkSyncHealth={checkSyncHealth}
            handleSyncLogin={handleSyncLogin}
            handleSyncNow={handleSyncNow}
            runSyncDiagnostics={runSyncDiagnostics}
            syncDiagnostic={syncDiagnostic}
            exportJson={exportJson}
            exportCsv={exportCsv}
            previewImportFile={previewImportFile}
            importSummary={importSummary}
            confirmImport={confirmImport}
            restoreBackup={restoreBackup}
            resolveSyncConflict={resolveSyncConflict}
            loadDemoData={loadDemoData}
          />
        )}
      </section>
      {state.activeTimer && tab !== "focus" && (
        <MiniTimer
          state={state}
          task={currentTask}
          toggleTimer={toggleTimer}
          finishTimer={finishTimer}
        />
      )}
      {deletedTaskSnapshot && (
        <div className="undo-banner" role="status">
          <span>已删除「{deletedTaskSnapshot.task.title}」</span>
          <button className="small-button" onClick={undoDeleteTask}>
            撤销
          </button>
        </div>
      )}
      <ConfirmDialog
        open={Boolean(pendingDeleteTask)}
        title="删除任务"
        body={pendingDeleteTask ? `确认删除「${pendingDeleteTask.title}」吗？删除后会从工作队列和同步队列中移除。` : ""}
        confirmLabel="删除"
        danger
        onCancel={() => setPendingDeleteTask(null)}
        onConfirm={confirmDeleteTask}
      />
      <ConfirmDialog
        open={pendingReset}
        title="重置当前计时"
        body="重置会把当前计时恢复到完整时长，并暂停计时。"
        confirmLabel="重置"
        onCancel={() => setPendingReset(false)}
        onConfirm={confirmResetTimer}
      />
      <SplitTaskDialog
        draft={pendingSplit}
        setDraft={setPendingSplit}
        onCancel={() => setPendingSplit(null)}
        onConfirm={confirmSplitTask}
      />
      <ShortcutHelpDialog open={showShortcutHelp} onClose={() => setShowShortcutHelp(false)} />
      <CommandPalette
        open={commandPaletteOpen}
        tasks={state.tasks}
        onClose={() => setCommandPaletteOpen(false)}
        onRun={runCommand}
      />
    </main>
  );
}
