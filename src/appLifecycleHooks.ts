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
import { useTeamBusinessRefresh, useTodayPlanRepair } from "./appLifecycleTeamHooks";
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
  persistBusinessChanges,
  commitBusinessState,
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
    persistBusinessChanges,
    setState,
    setToast,
    setLoaded,
    setPlatformAccounts,
    setWorkspaceInvitations,
    setProjectInvitations,
  });
  useDebouncedStatePersistence({ state, loaded, setToast });
  useTeamBusinessRefresh({ state, loaded, stateRef, setState });
  usePageLifecycleStateFlush({ stateRef });
  useRunningTimerInterval({ state, stateRef, setState, setToast, commitBusinessState });
  useTimerRestoreListeners({ stateRef, setState, setToast, commitBusinessState });
  useTodayPlanRepair({ state, commitBusinessState });
  useTimerRuntimeEffects({ state, stopNoiseRef });
  useTaskReminderInterval({ state, stateRef, reminderSentRef, commitBusinessState });
}
