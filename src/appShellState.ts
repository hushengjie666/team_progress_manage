import { useAppShellDataState } from "./appShellDataState";
import { useAppShellRefs } from "./appShellRefs";
import { useAppShellTaskState } from "./appShellTaskState";
import { useAppShellUiState } from "./appShellUiState";

export function useAppShellState() {
  const dataState = useAppShellDataState();
  const uiState = useAppShellUiState();
  const taskState = useAppShellTaskState();
  const refs = useAppShellRefs();

  return {
    ...dataState,
    ...uiState,
    ...taskState,
    ...refs,
  };
}
