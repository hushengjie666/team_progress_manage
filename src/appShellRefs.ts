import { useRef } from "react";
import type { Tab } from "./appModel";
import type { AppState } from "./types";

export function useAppShellRefs() {
  const stateRef = useRef<AppState | null>(null);
  const pendingImportPayloadRef = useRef<unknown>(null);
  const reminderSentRef = useRef<Set<string>>(new Set());
  const stopNoiseRef = useRef<(() => void) | null>(null);
  const undoTimerRef = useRef<number | null>(null);
  const tabRef = useRef<Tab>("workspace");
  const selectedTaskIdRef = useRef<string | null>(null);

  return {
    stateRef,
    pendingImportPayloadRef,
    reminderSentRef,
    stopNoiseRef,
    undoTimerRef,
    tabRef,
    selectedTaskIdRef,
  };
}
