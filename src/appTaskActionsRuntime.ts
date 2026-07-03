import { createAppTaskCreationRuntime } from "./appTaskCreationRuntime";
import { createAppTaskDeletionRuntime } from "./appTaskDeletionRuntime";
import { createAppTaskReviewRuntime } from "./appTaskReviewRuntime";
import { createAppTaskSplitRuntime } from "./appTaskSplitRuntime";
import { createAppTaskTemplateRuntime } from "./appTaskTemplateRuntime";
import { createAppTaskUpdateRuntime } from "./appTaskUpdateRuntime";
import type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

export type { AppTaskActionsRuntime, AppTaskActionsRuntimeOptions } from "./appTaskActionsTypes";

export function createAppTaskActionsRuntime(options: AppTaskActionsRuntimeOptions): AppTaskActionsRuntime {
  return {
    ...createAppTaskCreationRuntime(options),
    ...createAppTaskReviewRuntime(options),
    ...createAppTaskDeletionRuntime(options),
    ...createAppTaskUpdateRuntime(options),
    ...createAppTaskSplitRuntime(options),
    ...createAppTaskTemplateRuntime(options),
  };
}
