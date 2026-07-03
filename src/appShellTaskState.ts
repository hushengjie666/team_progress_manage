import { useState } from "react";
import {
  initialDraft,
  initialFilters,
  type DeletedTaskSnapshot,
  type SplitDraft,
  type TaskDraft,
  type TaskFilters,
} from "./appModel";
import { initialProjectTaskFilters, type ProjectTaskFilters } from "./projectDetail";
import type { Task } from "./types";

export function useAppShellTaskState() {
  const [projectTaskFilters, setProjectTaskFilters] = useState<ProjectTaskFilters>(initialProjectTaskFilters);
  const [draft, setDraft] = useState<TaskDraft>(initialDraft);
  const [quickNote, setQuickNote] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [preferredFocusTaskId, setPreferredFocusTaskId] = useState<string | null>(null);
  const [taskFilters, setTaskFilters] = useState<TaskFilters>(initialFilters);
  const [selectedWorkbenchProjectIds, setSelectedWorkbenchProjectIds] = useState<string[]>([]);
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  const [pendingSplit, setPendingSplit] = useState<SplitDraft | null>(null);
  const [pendingReset, setPendingReset] = useState(false);
  const [deletedTaskSnapshot, setDeletedTaskSnapshot] = useState<DeletedTaskSnapshot | null>(null);

  return {
    projectTaskFilters,
    setProjectTaskFilters,
    draft,
    setDraft,
    quickNote,
    setQuickNote,
    selectedTaskId,
    setSelectedTaskId,
    preferredFocusTaskId,
    setPreferredFocusTaskId,
    taskFilters,
    setTaskFilters,
    selectedWorkbenchProjectIds,
    setSelectedWorkbenchProjectIds,
    pendingDeleteTask,
    setPendingDeleteTask,
    pendingSplit,
    setPendingSplit,
    pendingReset,
    setPendingReset,
    deletedTaskSnapshot,
    setDeletedTaskSnapshot,
  };
}
