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
import { useTeamBusinessRefresh } from "./appLifecycleTeamHooks";
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
  runTeamCommand,
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
  useRunningTimerInterval({ state, stateRef, setState, setToast, runTeamCommand });
  useTimerRestoreListeners({ stateRef, setState, setToast, runTeamCommand });
  useTimerRuntimeEffects({ state, stopNoiseRef });
  useTaskReminderInterval({ state, stateRef, reminderSentRef, runTeamCommand });
}
