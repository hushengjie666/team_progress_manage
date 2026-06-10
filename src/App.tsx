import {
  BarChart3,
  CalendarDays,
  Focus,
  FolderKanban,
  LayoutDashboard,
  ListChecks,
  Menu,
  Settings,
  ShieldCheck,
  ShieldQuestion,
  UserCheck,
  TimerReset,
  Search,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  calculateRemaining,
  buildProgressBoard,
  defaultReview,
  deriveRewardState,
  generateRecurringTask,
  nextBreakMode,
  pauseTimer,
  planCapacityHint,
  planPressure,
  restoreTimer,
  suggestedCapacity,
  suggestedTasks,
  taskSuggestions,
} from "./domain";
import { playTimerSound, requestTimerNotifications, sendTimerNotification, startWhiteNoise } from "./notifications";
import { checkStrictModeViolation, loadState, requestStrictPermissions, saveState, startStrictMode, stopStrictMode } from "./storage";
import { loginToSyncServer, syncAppState } from "./sync";
import { buildCsvBundle, createBackupSnapshot, exportStateJson, mergeImportedState, summarizeImportPayload } from "./dataPortability";
import { createDemoState } from "./demoData";
import { instantiateTemplate, parseQuickInput } from "./planning";
import { runSyncDiagnostics as runSyncDiagnosticsApi } from "./syncDiagnostics";
import { updateDesktopTimerPresence } from "./nativeDesktop";
import {
  acceptTaskInState,
  addProjectMemberToState,
  assignTaskInState,
  createProjectInState,
  returnTaskForReviewInState,
  submitTaskForReviewInState,
  updateProjectInState,
  updateProjectMemberInState,
  updateTaskProgressInState,
} from "./teamProgress";
import { uid } from "./seed";
import type {
  AppState,
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
  TaskTemplate,
  WorkSession,
  ExecutionSignal,
} from "./types";
import { OnboardingView } from "./components/OnboardingView";
import { WorkspaceView } from "./components/WorkspaceView";
import { FocusView, MiniTimer } from "./components/FocusView";
import { ConfirmDialog, ShortcutHelpDialog, SplitTaskDialog } from "./components/Dialogs";
import { ReportsView } from "./components/ReportsView";
import { SettingsView } from "./components/SettingsView";
import { CalendarView } from "./components/CalendarView";
import { CommandPalette } from "./components/CommandPalette";
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
  priorityWeight,
  startTimerInState,
  today,
  toggleTimerInState,
  nowIso,
  type DeletedTaskSnapshot,
  type SplitDraft,
  type Tab,
  type TaskDraft,
  type TaskFilters,
} from "./appModel";

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [tab, setTab] = useState<Tab>("workspace");
  const [workspaceMode, setWorkspaceMode] = useState<"board" | "workbench">("board");
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [loaded, setLoaded] = useState(false);
  const [strictStatus, setStrictStatus] = useState<StrictModeStatus | null>(null);
  const [toast, setToast] = useState("本地优先模式已就绪");
  const [quickNote, setQuickNote] = useState("");
  const [syncPassword, setSyncPassword] = useState("demo");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(initialFilters);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [pendingSplit, setPendingSplit] = useState<SplitDraft | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [deletedTaskSnapshot, setDeletedTaskSnapshot] = useState<DeletedTaskSnapshot | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [syncDiagnostic, setSyncDiagnostic] = useState<SyncDiagnosticResult | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [showShortcutHelp, setShowShortcutHelp] = useState(false);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const stateRef = useRef<AppState | null>(null);
  const pendingImportPayloadRef = useRef<unknown>(null);
  const syncInFlightRef = useRef(false);
  const strictStartingRef = useRef<Set<string>>(new Set());
  const reminderSentRef = useRef<Set<string>>(new Set());
  const stopNoiseRef = useRef<(() => void) | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const tabRef = useRef<Tab>("workspace");
  const selectedTaskIdRef = useRef<string | null>(null);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

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

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const current = stateRef.current;
      const currentTab = tabRef.current;
      const target = event.target as HTMLElement | null;
      const editing = target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      const isSlash = event.key === "/" && !event.metaKey && !event.ctrlKey && !event.altKey;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && !event.shiftKey) {
        if (event.key === "1") {
          event.preventDefault();
          setTab("settings");
          return;
        }
        if (event.key === "2") {
          event.preventDefault();
          setWorkspaceMode("board");
          setTab("workspace");
          return;
        }
        if (event.key === "3") {
          event.preventDefault();
          setWorkspaceMode("workbench");
          setTab("workspace");
          return;
        }
        if (event.key === "4") {
          event.preventDefault();
          setTab("calendar");
          return;
        }
        if (event.key === "5") {
          event.preventDefault();
          setTab("reports");
          return;
        }
      }
      if (event.key === "Escape") {
        setCommandPaletteOpen(false);
        setShowShortcutHelp(false);
        return;
      }
      if (!editing && isSlash) {
        event.preventDefault();
        setCommandPaletteOpen(true);
        return;
      }
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
        event.preventDefault();
        const plan = current ? getTodayPlan(current) : null;
        if (current && plan && !plan.reviewedAt && currentTab === "workspace") {
          completeReview();
        }
        return;
      }

      if (editing || !current) return;

      if (event.code === "Space" || event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) {
          if (current.activeTimer) setPendingReset(true);
          return;
        }
        if (!current.activeTimer) {
          if (currentTab !== "workspace") return;
          const plan = getTodayPlan(current);
          const selected = selectedTaskIdRef.current && plan.committedTaskIds.includes(selectedTaskIdRef.current)
            ? selectedTaskIdRef.current
            : plan.committedTaskIds[0];
          if (selected) {
            setTab("focus");
            void beginTimer("focus", selected);
          }
          return;
        }
        toggleTimer();
        return;
      }

      const plan = getTodayPlan(current);
      const committedIds = plan.committedTaskIds;

      if (currentTab === "workspace" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const direction: -1 | 1 = event.key === "ArrowUp" ? -1 : 1;
        const currentSelected = selectedTaskIdRef.current;
        if (!committedIds.length) return;

        const selectedId = currentSelected && committedIds.includes(currentSelected) ? currentSelected : committedIds[0];
        if (!selectedId) return;
        setSelectedTaskId(selectedId);

        if (currentSelected && committedIds.includes(currentSelected)) {
          const currentIndex = committedIds.indexOf(currentSelected);
          const nextIndex = currentIndex + direction;
          if (nextIndex < 0 || nextIndex >= committedIds.length) return;
          moveCommittedTask(currentSelected, direction);
          setSelectedTaskId(committedIds[nextIndex]);
        }
        return;
      }

      if (event.key === "Enter" && currentTab === "workspace" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        const selectedId = selectedTaskIdRef.current && committedIds.includes(selectedTaskIdRef.current)
          ? selectedTaskIdRef.current
          : committedIds[0];
        if (!selectedId || current.activeTimer) return;
        setTab("focus");
        void beginTimer("focus", selectedId);
      }

      if (event.key === "q" && !event.shiftKey && !event.metaKey && !event.ctrlKey && !event.altKey && currentTab === "focus") {
        event.preventDefault();
        setTab("workspace");
        return;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    loadState()
      .then((value) => {
        const params = new URLSearchParams(window.location.search);
        const shouldLoadDemo = params.get("demo") === "1" || sessionStorage.getItem("timemanage.load_demo") === "1";
        if (params.get("demo") === "1") sessionStorage.setItem("timemanage.load_demo", "1");
        if (shouldLoadDemo) {
          setState(ensureTodayPlan(createDemoState()));
          window.history.replaceState(null, "", window.location.pathname);
          setToast("已加载演示数据");
          setLoaded(true);
          return;
        }
        setState(ensureTodayPlan({ ...value, activeTimer: restoreTimer(value.activeTimer) }));
        setLoaded(true);
      })
      .catch(() => {
        setToast("读取本地状态失败，已加载默认数据");
      });
  }, []);

  useEffect(() => {
    if (!state || !loaded) return;
    const handle = window.setTimeout(() => {
      saveState(state).catch(() => setToast("保存失败，请检查本地权限"));
    }, 250);
    return () => window.clearTimeout(handle);
  }, [state, loaded]);

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
      setState((current) => {
        if (!current?.activeTimer?.isRunning) return current;
        const nextRemaining = calculateRemaining(current.activeTimer);
        if (nextRemaining > 0) {
          return {
            ...current,
            activeTimer: { ...current.activeTimer, remaining: nextRemaining },
            updatedAt: nowIso(),
          };
        }
        const title = `${modeLabel[current.activeTimer.mode]}已结束`;
        const body =
          current.activeTimer.mode === "focus"
            ? "记录一个番茄，休息一下再继续。"
            : "休息结束，可以回到当下清单。";
        setToast(title);
        playTimerSound(current.settings);
        void sendTimerNotification(current.settings, title, body);
        stopStrictMode().then(setStrictStatus).catch(() => undefined);
        if (current.activeTimer.mode === "focus" && current.settings.autoStartBreaks) {
          const ended = endSessionInState(current, "completed");
          return startTimerInState(ended, nextBreakMode(ended), undefined, nowIso());
        }
        if (current.activeTimer.mode !== "focus" && current.settings.autoStartFocus) {
          const ended = endSessionInState(current, "completed");
          const nextTask = ended.tasks.find((task) => task.status === "committed" || task.status === "in_progress");
          return startTimerInState(ended, "focus", nextTask?.id, nowIso(), ended.settings.activeBlockProfileId);
        }
        return {
          ...current,
          activeTimer: { ...current.activeTimer, remaining: 0, isRunning: false, pendingSettlement: "pending" },
          updatedAt: nowIso(),
        };
      });
    }, 1000);
    return () => window.clearInterval(handle);
  }, [state?.activeTimer?.isRunning]);

  useEffect(() => {
    const handle = () => {
      setState((current) => (current?.activeTimer ? { ...current, activeTimer: restoreTimer(current.activeTimer), updatedAt: nowIso() } : current));
    };
    document.addEventListener("visibilitychange", handle);
    window.addEventListener("focus", handle);
    return () => {
      document.removeEventListener("visibilitychange", handle);
      window.removeEventListener("focus", handle);
    };
  }, []);

  useEffect(() => {
    if (!state?.sync.enabled || !state.sync.token || !state.sync.autoSync) return;
    const intervalMs = Math.max(30, state.sync.intervalSeconds) * 1000;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.sync.enabled || !current.sync.token || !current.sync.autoSync) return;
      if (current.sync.nextRetryAt && Date.now() < new Date(current.sync.nextRetryAt).getTime()) return;
      if (current.sync.status === "syncing" || current.sync.status === "authenticating") return;
      void runSync(false);
    }, intervalMs);
    return () => window.clearInterval(handle);
  }, [state?.sync.enabled, state?.sync.token, state?.sync.autoSync, state?.sync.intervalSeconds]);

  useEffect(() => {
    stopNoiseRef.current?.();
    stopNoiseRef.current = null;
    if (!state?.activeTimer?.isRunning || !state.settings.soundEnabled || state.settings.whiteNoise === "off") return;
    stopNoiseRef.current = startWhiteNoise(state.settings.whiteNoise, state.settings.whiteNoiseVolume);
    return () => {
      stopNoiseRef.current?.();
      stopNoiseRef.current = null;
    };
  }, [
    state?.activeTimer?.isRunning,
    state?.activeTimer?.mode,
    state?.settings.soundEnabled,
    state?.settings.whiteNoise,
    state?.settings.whiteNoiseVolume,
  ]);

  useEffect(() => {
    const active = state?.activeTimer;
    const title = active
      ? `${formatTime(active.remaining)} · ${modeLabel[active.mode]} · TimeManage`
      : "TimeManage";
    void updateDesktopTimerPresence(Boolean(active), title);
  }, [state?.activeTimer?.remaining, state?.activeTimer?.mode, state?.activeTimer?.sessionId]);

  useEffect(() => {
    if (!state?.settings.notificationsEnabled) return;
    const handle = window.setInterval(() => {
      const current = stateRef.current;
      if (!current?.settings.notificationsEnabled) return;
      const now = Date.now();
      for (const task of current.tasks) {
        if (!task.reminderAt || task.status === "completed" || reminderSentRef.current.has(task.id) || task.lastReminderSentAt) continue;
        const reminderTime = new Date(task.reminderAt).getTime();
        if (!Number.isNaN(reminderTime) && reminderTime <= now) {
          reminderSentRef.current.add(task.id);
          void sendTimerNotification(current.settings, "任务提醒", task.title);
          setState((value) =>
            value
              ? {
                  ...value,
                  tasks: value.tasks.map((item) =>
                    item.id === task.id ? { ...item, lastReminderSentAt: nowIso(), updatedAt: nowIso() } : item,
                  ),
                  updatedAt: nowIso(),
                }
              : value,
          );
        }
      }
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
        setToast(status.message);
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
        setState((value) => {
          if (!value?.activeTimer) return value;
          return {
            ...value,
            strictViolations: [violation, ...value.strictViolations],
            activeTimer: shouldPause ? pauseTimer(value.activeTimer, now) : value.activeTimer,
            updatedAt: now,
          };
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
    return todayPlan.committedTaskIds
      .map((id) => state.tasks.find((task) => task.id === id))
      .filter((task): task is Task => Boolean(task));
  }, [state, todayPlan]);

  const poolTasks = useMemo(() => {
    if (!state || !todayPlan) return [];
    const query = taskFilters.query.trim().toLowerCase();
    const filtered = state.tasks.filter((task) => {
      const matchesQuery =
        !query ||
        task.title.toLowerCase().includes(query) ||
        task.notes.toLowerCase().includes(query) ||
        task.project.toLowerCase().includes(query) ||
        task.tags.some((tag) => tag.toLowerCase().includes(query));
      return (
        task.status !== "completed" &&
        task.status !== "archived" &&
        !todayPlan.committedTaskIds.includes(task.id) &&
        matchesQuery &&
        (taskFilters.project === "all" || task.project === taskFilters.project) &&
        (taskFilters.tag === "all" || task.tags.includes(taskFilters.tag)) &&
        (taskFilters.priority === "all" || task.priority === taskFilters.priority)
      );
    });
    return [...filtered].sort((left, right) => {
      if (taskFilters.sort === "dueAt") return (left.dueAt ?? "9999").localeCompare(right.dueAt ?? "9999");
      if (taskFilters.sort === "priority") return priorityWeight[right.priority] - priorityWeight[left.priority];
      if (taskFilters.sort === "estimate") return right.estimatePomodoros - left.estimatePomodoros;
      return left.sortOrder - right.sortOrder;
    });
  }, [state, todayPlan, taskFilters]);

  const currentTask = useMemo(() => {
    if (!state?.activeTimer?.taskId) return committedTasks.find((task) => task.status !== "completed");
    return state.tasks.find((task) => task.id === state.activeTimer?.taskId);
  }, [state, committedTasks]);

  const selectedTask = useMemo(() => {
    if (!state || !selectedTaskId) return undefined;
    return state.tasks.find((task) => task.id === selectedTaskId);
  }, [state, selectedTaskId]);

  if (!state || !todayPlan) {
    return (
      <main className="boot">
        <div className="boot-mark">
          <TimerReset size={36} />
        </div>
        <p>正在加载 TimeManage...</p>
      </main>
    );
  }

  const updateState = (updater: (value: AppState) => AppState) => {
    setState((current) => (current ? ensureTodayPlan(updater(current)) : current));
  };
  const currentProjectId = state.projects[0]?.id ?? "project_starter";

  const addTask = () => {
    const title = draft.title.trim();
    if (!title) {
      setToast("先写一个任务名称");
      return;
    }
    const timestamp = nowIso();
    const task: Task = {
      id: uid("task"),
      title,
      notes: draft.notes.trim(),
      tags: draft.tags
        .split(/[,\s，]+/)
        .map((item) => item.trim())
        .filter(Boolean),
      projectId: currentProjectId,
      project: draft.project.trim() || "Inbox",
      creatorMemberId: state.currentMemberId,
      priority: draft.priority,
      severity: draft.severity,
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

  const commitTask = (taskId: string) => {
    updateState((value) => {
      const plan = getTodayPlan(value);
      const nextPlan = {
        ...plan,
        committedTaskIds: Array.from(new Set([...plan.committedTaskIds, taskId])),
        updatedAt: nowIso(),
      };
      return {
        ...value,
        tasks: value.tasks.map((task) =>
          task.id === taskId && task.status === "pool"
            ? { ...task, status: "committed", updatedAt: nowIso() }
            : task,
        ),
        dailyPlans: value.dailyPlans.some((item) => item.id === nextPlan.id)
          ? value.dailyPlans.map((item) => (item.id === nextPlan.id ? nextPlan : item))
          : [...value.dailyPlans, nextPlan],
        updatedAt: nowIso(),
      };
    });
    setToast("已加入工作队列");
  };

  const removeCommittedTask = (taskId: string) => {
    updateState((value) => {
      const plan = getTodayPlan(value);
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id
            ? {
                ...item,
                committedTaskIds: item.committedTaskIds.filter((id) => id !== taskId),
                updatedAt: nowIso(),
              }
            : item,
        ),
        tasks: value.tasks.map((task) =>
          task.id === taskId && task.status === "committed"
            ? { ...task, status: "pool", updatedAt: nowIso() }
            : task,
        ),
        updatedAt: nowIso(),
      };
    });
  };

  const completeTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => submitTaskForReviewInState(value, taskId, value.currentMemberId, timestamp));
    setToast("已提交验收，等待项目负责人确认");
  };

  const acceptTask = (taskId: string) => {
    const timestamp = nowIso();
    updateState((value) => {
      const acceptedState = acceptTaskInState(value, taskId, value.currentMemberId, timestamp);
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
    setToast("验收通过，任务已完成");
  };

  const returnTaskForReview = (taskId: string, reason: string) => {
    const timestamp = nowIso();
    updateState((value) => returnTaskForReviewInState(value, taskId, reason, value.currentMemberId, timestamp));
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
          { entity: "task", id: taskId, deletedAt: timestamp },
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
    updateState((value) => {
      return startTimerInState(value, mode, taskId, timestamp, activeProfile?.id, sessionId);
    });

    if (mode === "focus" && state.settings.strictModeEnabled) {
      strictStartingRef.current.add(sessionId);
      const status = await startStrictMode(activeProfile);
      setStrictStatus(status);
      setToast(status.message);
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
      title: source.note,
      notes: "由中断收件箱转入活动清单。",
      tags: [source.type === "internal" ? "内部中断" : "外部中断"],
      projectId: currentProjectId,
      project: "Inbox",
      creatorMemberId: state.currentMemberId,
      priority: source.type === "external" ? "high" : "medium",
      severity: "medium",
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

  const createProject = (name: string, description: string) => {
    const timestamp = nowIso();
    updateState((value) => createProjectInState(value, name, description, timestamp));
    setToast("项目已创建");
  };

  const updateProject = (project: Project) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectInState(value, project, timestamp));
  };

  const addProjectMember = (projectId: string, name: string, email: string, roles: ProjectMemberRole[]) => {
    const timestamp = nowIso();
    updateState((value) => addProjectMemberToState(value, projectId, name, email, roles, timestamp));
    setToast("项目成员已添加");
  };

  const updateProjectMember = (member: ProjectMember) => {
    const timestamp = nowIso();
    updateState((value) => updateProjectMemberInState(value, member, timestamp));
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

  const acknowledgeOverload = () => {
    const timestamp = nowIso();
    updateState((value) => {
      const plan = getTodayPlan(value);
      return {
        ...value,
        dailyPlans: value.dailyPlans.map((item) =>
          item.id === plan.id ? { ...item, overloadAcknowledged: true, updatedAt: timestamp } : item,
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
      title,
      notes: `由「${task.title}」拆分而来。`,
      tags: task.tags,
      projectId: task.projectId,
      project: task.project,
      creatorMemberId: state.currentMemberId ?? task.creatorMemberId,
      primaryExecutorMemberId: task.primaryExecutorMemberId,
      collaboratorMemberIds: task.collaboratorMemberIds ?? [],
      expectedStartAt: task.expectedStartAt,
      expectedFinishAt: task.expectedFinishAt,
      progressPercent: 0,
      progressNote: "",
      priority: task.priority,
      severity: task.severity,
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
            item.id === task.id ? { ...item, status: "archived" as const, updatedAt: timestamp } : item,
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
    setSelectedTaskId(newTasks[0]?.id ?? null);
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

  const setSyncStatus = (patch: Partial<SyncState>) => {
    updateState((current) => ({
      ...current,
      sync: { ...current.sync, ...patch, tombstones: patch.tombstones ?? current.sync.tombstones },
      updatedAt: nowIso(),
    }));
  };

  const handleSyncLogin = async () => {
    setSyncStatus({ status: "authenticating", message: "正在登录同步服务" });
    try {
      const nextSync = await loginToSyncServer(state.sync, syncPassword);
      updateState((current) => ({
        ...current,
        sync: { ...nextSync, retryCount: 0, nextRetryAt: undefined },
        updatedAt: nowIso(),
      }));
      setToast("同步服务已连接");
    } catch (error) {
      const message = error instanceof Error ? error.message : "登录同步服务失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const checkSyncHealth = async () => {
    setSyncStatus({ status: "syncing", message: "正在检查同步服务健康状态" });
    try {
      const healthUrl = new URL("/health", state.sync.serverUrl.endsWith("/") ? state.sync.serverUrl : `${state.sync.serverUrl}/`).toString();
      const response = await fetch(healthUrl);
      if (!response.ok) throw new Error(`健康检查返回 ${response.status}`);
      setSyncStatus({ status: state.sync.token ? "synced" : "idle", message: `同步服务可访问：${healthUrl}` });
      setToast("同步服务健康检查通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步服务健康检查失败";
      setSyncStatus({ status: "error", message });
      setToast(message);
    }
  };

  const runSync = async (showToast: boolean) => {
    const source = stateRef.current;
    if (!source || syncInFlightRef.current) return;
    syncInFlightRef.current = true;
    setSyncStatus({ status: "syncing", message: "正在推送与拉取变更" });
    try {
      const nextState = await syncAppState({ ...source, sync: { ...source.sync, status: "syncing" } });
      setState(ensureTodayPlan(nextState));
      if (showToast) setToast(nextState.sync.message);
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步失败";
      const retryCount = (source.sync.retryCount ?? 0) + 1;
      const delaySeconds = Math.min(15 * 60, 2 ** Math.min(retryCount, 6) * 10);
      const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString();
      setSyncStatus({
        status: "error",
        message: `${message}，${delaySeconds} 秒后自动重试`,
        retryCount,
        nextRetryAt,
      });
      if (showToast) setToast(message);
    } finally {
      syncInFlightRef.current = false;
    }
  };

  const handleSyncNow = async () => {
    await runSync(true);
  };

  const completeOnboarding = (payload: {
    distractionSources: string[];
    desiredHabit: string;
    currentDailyWasteMinutes: number;
    dailyGoalPomodoros: number;
    preferredFocusMinutes: number;
    strictModeIntent: AppState["onboarding"]["strictModeIntent"];
    syncIntent: AppState["onboarding"]["syncIntent"];
    blockedApps: string[];
    blockedWebsites: string[];
  }) => {
    const timestamp = nowIso();
    updateState((value) => {
      const activeProfileId = value.settings.activeBlockProfileId ?? value.blockProfiles[0]?.id ?? "profile_default";
      const existingProfile = value.blockProfiles.find((profile) => profile.id === activeProfileId) ?? value.blockProfiles[0];
      const profile = {
        ...(existingProfile ?? {
          id: activeProfileId,
          name: "深度专注",
          schedule: "专注番茄期间",
          platformPermissionState: "unknown" as const,
          createdAt: timestamp,
        }),
        apps: payload.blockedApps,
        websites: payload.blockedWebsites,
        strictness: payload.strictModeIntent,
        updatedAt: timestamp,
      };
      return {
        ...value,
        onboarding: {
          completed: true,
          distractionSources: payload.distractionSources,
          desiredHabit: payload.desiredHabit,
          currentDailyWasteMinutes: payload.currentDailyWasteMinutes,
          dailyGoalPomodoros: payload.dailyGoalPomodoros,
          preferredFocusMinutes: payload.preferredFocusMinutes,
          strictModeIntent: payload.strictModeIntent,
          syncIntent: payload.syncIntent,
        },
        settings: {
          ...value.settings,
          focusMinutes: payload.preferredFocusMinutes,
          strictModeEnabled: payload.strictModeIntent !== "soft",
          activeBlockProfileId: profile.id,
        },
        rewardState: {
          ...value.rewardState,
          dailyGoal: payload.dailyGoalPomodoros,
          badges: Array.from(new Set([...value.rewardState.badges, "完成启动问卷"])),
        },
        blockProfiles: value.blockProfiles.some((item) => item.id === profile.id)
          ? value.blockProfiles.map((item) => (item.id === profile.id ? profile : item))
          : [profile, ...value.blockProfiles],
        updatedAt: timestamp,
      };
    });
    setToast("启动问卷已完成，今天从可兑现的承诺开始");
  };

  const restartOnboarding = () => {
    updateState((value) => ({
      ...value,
      onboarding: { ...value.onboarding, completed: false },
      updatedAt: nowIso(),
    }));
  };

  const downloadText = (filename: string, text: string, mime = "text/plain;charset=utf-8") => {
    const blob = new Blob([text], { type: mime });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const exportJson = () => {
    const snapshot = createBackupSnapshot(state, "manual_export");
    updateState((value) => ({
      ...value,
      backupSnapshots: [snapshot, ...(value.backupSnapshots ?? [])].slice(0, 10),
      updatedAt: nowIso(),
    }));
    downloadText(`timemanage-${today()}.json`, exportStateJson(state), "application/json;charset=utf-8");
    setToast("完整 JSON 已导出");
  };

  const exportCsv = () => {
    downloadText(`timemanage-${today()}.csv`, buildCsvBundle(state), "text/csv;charset=utf-8");
    setToast("CSV 审计文件已导出");
  };

  const previewImportFile = async (file: File) => {
    try {
      const payload = JSON.parse(await file.text());
      pendingImportPayloadRef.current = payload;
      setImportSummary(summarizeImportPayload(payload, state));
    } catch {
      pendingImportPayloadRef.current = null;
      setImportSummary(summarizeImportPayload(null, state));
    }
  };

  const confirmImport = () => {
    if (!pendingImportPayloadRef.current) return;
    const backup = createBackupSnapshot(state, "before_import");
    downloadText(`timemanage-before-import-${today()}.json`, exportStateJson(state), "application/json;charset=utf-8");
    try {
      setState(ensureTodayPlan(mergeImportedState(state, pendingImportPayloadRef.current, backup)));
      pendingImportPayloadRef.current = null;
      setImportSummary(null);
      setToast("导入完成，已自动备份导入前数据");
    } catch (error) {
      const message = error instanceof Error ? error.message : "导入失败";
      setToast(message);
    }
  };

  const restoreBackup = (backupId: string) => {
    const backup = state.backupSnapshots.find((item) => item.id === backupId);
    if (!backup?.payload) {
      setToast("这条备份只有摘要，无法直接恢复");
      return;
    }
    try {
      const payload = JSON.parse(backup.payload);
      const restorePoint = createBackupSnapshot(state, "auto");
      setState(ensureTodayPlan(mergeImportedState(state, payload, restorePoint)));
      setToast("已从备份恢复，恢复前状态也已保留为自动备份");
    } catch {
      setToast("备份内容无法解析");
    }
  };

  const runSyncDiagnostics = async () => {
    setSyncStatus({ status: "syncing", message: "正在运行同步诊断" });
    try {
      const { result, state: diagnosedState } = await runSyncDiagnosticsApi(state, syncPassword);
      setSyncDiagnostic(result);
      setState(ensureTodayPlan(diagnosedState));
      setToast(result.lastError ? `诊断完成：${result.lastError}` : "同步诊断通过");
    } catch (error) {
      const message = error instanceof Error ? error.message : "同步诊断失败";
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
    updateState((value) => {
      let next = value;
      if (action === "remote" && conflict.remotePayload && typeof conflict.remotePayload === "object") {
        const payload = conflict.remotePayload as Partial<Task> & Record<string, unknown>;
        if (conflict.entity === "project") next = { ...next, projects: next.projects.map((project) => (project.id === conflict.id ? { ...project, ...payload, id: conflict.id } as Project : project)) };
        if (conflict.entity === "project_member") next = { ...next, projectMembers: next.projectMembers.map((member) => (member.id === conflict.id ? { ...member, ...payload, id: conflict.id } as ProjectMember : member)) };
        if (conflict.entity === "task") next = { ...next, tasks: next.tasks.map((task) => (task.id === conflict.id ? { ...task, ...payload, id: conflict.id } as Task : task)) };
        if (conflict.entity === "work_session") next = { ...next, workSessions: next.workSessions.map((session) => (session.id === conflict.id ? { ...session, ...payload, id: conflict.id } as WorkSession : session)) };
        if (conflict.entity === "execution_signal") next = { ...next, executionSignals: next.executionSignals.map((signal) => (signal.id === conflict.id ? { ...signal, ...payload, id: conflict.id } as ExecutionSignal : signal)) };
        if (conflict.entity === "daily_plan") next = { ...next, dailyPlans: next.dailyPlans.map((plan) => (plan.id === conflict.id ? { ...plan, ...payload, id: conflict.id } as DailyPlan : plan)) };
        if (conflict.entity === "settings") next = { ...next, settings: { ...next.settings, ...payload } as AppState["settings"] };
      }
      return {
        ...next,
        sync: {
          ...next.sync,
          conflicts: next.sync.conflicts.filter((item) => !(item.entity === conflict.entity && item.id === conflict.id && item.revision === conflict.revision)),
          conflictCount: Math.max(0, next.sync.conflictCount - 1),
          message: action === "local" ? "已选择保留本地版本，下次同步会继续推送本地快照。" : "已使用远端版本覆盖本地可识别字段。",
        },
        updatedAt: timestamp,
      };
    });
    setToast(action === "local" ? "已保留本地版本" : "已使用远端版本");
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
      title: parsed.title,
      notes: "由命令面板自然语言快捷添加。",
      tags: parsed.tags,
      projectId: currentProjectId,
      project: parsed.project ?? "Inbox",
      creatorMemberId: state.currentMemberId,
      priority: parsed.priority ?? "medium",
      severity: "medium",
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
    if (action === "navigate_reports") setTab("reports");
    if (action === "navigate_settings" || action === "open_sync_settings") setTab("settings");
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

  const loadDemoData = () => {
    setState(ensureTodayPlan(createDemoState()));
    setSelectedTaskId("demo_task_today_deep");
    setTaskFilters(initialFilters);
    setWorkspaceMode("board");
    setTab("workspace");
    setToast("已加载演示数据，可以从进度看板开始体验");
  };

  const totalCommittedEstimate = committedTasks.reduce((sum, task) => sum + task.estimatePomodoros, 0);
  const capacityHint = planCapacityHint(state);
  const primaryProjectId = state.projects[0]?.id ?? "";
  const sidebarBoard = primaryProjectId ? buildProgressBoard(state, primaryProjectId) : undefined;
  const sidebarRiskCount = sidebarBoard?.sections.filter((section) => section.kind !== "normal").reduce((sum, section) => sum + section.tasks.length, 0) ?? 0;
  const activeNavKey = tab === "workspace" ? workspaceMode : tab === "settings" ? "projects" : tab;
  const openProjects = () => setTab("settings");
  const openBoard = () => {
    setWorkspaceMode("board");
    setTab("workspace");
  };
  const openWorkbench = () => {
    setWorkspaceMode("workbench");
    setTab("workspace");
  };
  const primaryNavItems = [
    { key: "projects", label: "项目", icon: <FolderKanban size={18} />, onClick: openProjects },
    { key: "board", label: "进度看板", icon: <LayoutDashboard size={18} />, onClick: openBoard },
    { key: "workbench", label: "我的工作台", icon: <UserCheck size={18} />, onClick: openWorkbench },
  ];
  const secondaryNavItems = [
    { key: "focus", label: "计时器", icon: <Focus size={18} />, onClick: () => setTab("focus") },
    { key: "calendar", label: "排期", icon: <CalendarDays size={18} />, onClick: () => setTab("calendar") },
    { key: "reports", label: "洞察", icon: <BarChart3 size={18} />, onClick: () => setTab("reports") },
  ];
  const topbarNavItems = [...primaryNavItems, ...secondaryNavItems];

  if (!state.onboarding.completed) {
    return <OnboardingView state={state} completeOnboarding={completeOnboarding} />;
  }

  return (
    <main className={sidebarExpanded ? "app-shell sidebar-open" : "app-shell sidebar-collapsed"}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <TimerReset size={24} />
          </div>
          <div>
            <strong>Team Progress</strong>
            <span>团队进度管控</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="主导航">
          <span className="nav-group-label">团队进度</span>
          {primaryNavItems.map((item) => (
            <button className={activeNavKey === item.key ? "active" : ""} title={item.label} onClick={item.onClick} key={item.key}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
          <span className="nav-group-label">辅助工具</span>
          {secondaryNavItems.map((item) => (
            <button className={activeNavKey === item.key ? "active" : ""} title={item.label} onClick={item.onClick} key={item.key}>
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-status">
          <span>项目进度</span>
          <strong>
            {sidebarBoard?.projectProgress ?? 0}%
          </strong>
          <div className="mini-progress">
            <span
              style={{
                width: `${sidebarBoard?.projectProgress ?? 0}%`,
              }}
            />
          </div>
          <small>执行中 {sidebarBoard?.activeSessions.length ?? 0} · 风险 {sidebarRiskCount}</small>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="topbar-heading">
            <button className="icon-button" title={sidebarExpanded ? "收起侧栏" : "展开侧栏"} onClick={() => setSidebarExpanded((value) => !value)}>
              <Menu size={18} />
            </button>
            <div>
              <p className="eyebrow">{today()}</p>
              <h1>
                {tab === "settings"
                  ? "项目与成员"
                  : tab === "workspace"
                    ? workspaceMode === "board" ? "项目进度看板" : "我的工作台"
                  : tab === "focus"
                    ? "工作计时器"
                    : tab === "calendar"
                      ? "排期计划"
                      : tab === "reports"
                        ? "进度洞察"
                        : "系统设置"}
              </h1>
            </div>
          </div>
          <nav className="topbar-nav" aria-label="页面导航">
            {topbarNavItems.map((item) => (
              <button className={activeNavKey === item.key ? "active" : ""} onClick={item.onClick} key={item.key}>
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="topbar-actions">
            <span className="toast">{toast}</span>
            <button className="secondary-button" onClick={loadDemoData}>
              演示数据
            </button>
            <button className="icon-button" title="命令面板" onClick={() => setCommandPaletteOpen(true)}>
              <Search size={18} />
            </button>
            <button className="icon-button" title="严格模式权限" onClick={askPermissions}>
              {strictStatus?.permission_state === "granted" ? <ShieldCheck size={18} /> : <ShieldQuestion size={18} />}
            </button>
          </div>
        </header>

        {tab === "workspace" && (
          <WorkspaceView
            mode={workspaceMode}
            state={state}
            draft={draft}
            setDraft={setDraft}
            addTask={addTask}
            poolTasks={poolTasks}
            committedTasks={committedTasks}
            todayPlan={todayPlan}
            selectedTask={selectedTask}
            taskFilters={taskFilters}
            setTaskFilters={setTaskFilters}
            capacityHint={capacityHint}
            totalCommittedEstimate={totalCommittedEstimate}
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
            acknowledgeOverload={acknowledgeOverload}
            generateTodayPlan={generateTodayPlan}
            dismissCoachStep={dismissCoachStep}
            splitTask={splitTask}
            beginFocus={(taskId) => {
              setTab("focus");
              void beginTimer("focus", taskId);
            }}
            openProjectSettings={openProjects}
            updateReflection={updateReflection}
            updateReview={updateReview}
            completeReview={completeReview}
            resolveInterruption={resolveInterruption}
            convertInterruptionToTask={convertInterruptionToTask}
          />
        )}

        {tab === "focus" && (
          <FocusView
            state={state}
            currentTask={currentTask}
            committedTasks={committedTasks}
            activeProfile={activeProfile}
            quickNote={quickNote}
            setQuickNote={setQuickNote}
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
            state={state}
            activeProfile={activeProfile}
            strictStatus={strictStatus}
            updateSettings={updateSettings}
            createProject={createProject}
            updateProject={updateProject}
            addProjectMember={addProjectMember}
            updateProjectMember={updateProjectMember}
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
            restartOnboarding={restartOnboarding}
          />
        )}
      </section>
      {state.activeTimer && tab !== "focus" && (
        <MiniTimer
          state={state}
          task={currentTask}
          toggleTimer={toggleTimer}
          finishTimer={finishTimer}
          openFocus={() => setTab("focus")}
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
