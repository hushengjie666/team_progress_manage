import {
  useInitialAppLoad,
  useDebouncedStatePersistence,
  useNavigationRefs,
  usePageLifecycleStateFlush,
  useStateRef,
  useToastVisibility,
  useUndoTimerCleanup,
} from "./appLifecyclePersistenceHooks";
import {
  useRunningTimerInterval,
  useTaskReminderInterval,
  useTimerRestoreListeners,
  useTimerRuntimeEffects,
} from "./appLifecycleTimerHooks";
import { useTeamRevisionPolling, useTodayPlanRepair } from "./appLifecycleTeamHooks";
import type { AppLifecycleHooksOptions } from "./appLifecycleTypes";

export type { AppLifecycleHooksOptions } from "./appLifecycleTypes";

export function useAppLifecycleHooks({
  state,
  loaded,
  toast,
  tab,
  selectedTaskId,
  stateRef,
  tabRef,
  selectedTaskIdRef,
  undoTimerRef,
  stopNoiseRef,
  reminderSentRef,
  persistTeamChanges,
  commitTeamState,
  setState,
  setToast,
  setToastVisible,
  setLoaded,
  setPlatformAccounts,
  setWorkspaceInvitations,
  setProjectInvitations,
}: AppLifecycleHooksOptions) {
  useStateRef({ state, stateRef });
  useToastVisibility({ toast, setToastVisible });
  useUndoTimerCleanup({ undoTimerRef });
  useNavigationRefs({ tab, selectedTaskId, tabRef, selectedTaskIdRef });
  useInitialAppLoad({
    persistTeamChanges,
    setState,
    setToast,
    setLoaded,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });
  useDebouncedStatePersistence({ state, loaded, setToast });
  useTeamRevisionPolling({ state, loaded, stateRef, setState });
  usePageLifecycleStateFlush({ stateRef });
  useRunningTimerInterval({ state, stateRef, setState, setToast, commitTeamState });
  useTimerRestoreListeners({ stateRef, setState, setToast, commitTeamState });
  useTodayPlanRepair({ state, commitTeamState });
  useTimerRuntimeEffects({ state, stopNoiseRef });
  useTaskReminderInterval({ state, stateRef, reminderSentRef, commitTeamState });
}
