package main

import (
	"context"
	"database/sql"
	"strings"
)

func completeFocusedTaskInTx(ctx context.Context, tx *sql.Tx, auth authContext, workspaceID string, sessionPayload map[string]any, now string) error {
	taskID, _ := sessionPayload["taskId"].(string)
	taskID = strings.TrimSpace(taskID)
	if taskID == "" {
		return nil
	}
	task, found, err := businessExistingRowForUpdate(ctx, tx, workspaceID, "task", taskID)
	if err != nil || !found {
		return err
	}
	taskPayload, err := rowPayloadObject(task)
	if err != nil {
		return err
	}
	taskPayload["status"] = "in_progress"
	taskPayload["actualPomodoros"] = numericInt(taskPayload["actualPomodoros"]) + 1
	if err := savePayloadObject(ctx, tx, task, taskPayload, now); err != nil {
		return err
	}

	date := now[:10]
	if startedAt, ok := sessionPayload["startedAt"].(string); ok && len(startedAt) >= 10 {
		date = startedAt[:10]
	}
	planID := "plan_" + auth.AccountID + "_" + workspaceID + "_" + date
	plan, planFound, err := businessExistingRowForUpdate(ctx, tx, workspaceID, "daily_plan", planID)
	if err != nil || !planFound {
		return err
	}
	planPayload, err := rowPayloadObject(plan)
	if err != nil {
		return err
	}
	if containsString(stringSliceField(plan.Payload, "committedTaskIds"), taskID) {
		planPayload["completedPomodoros"] = numericInt(planPayload["completedPomodoros"]) + 1
		return savePayloadObject(ctx, tx, plan, planPayload, now)
	}
	return nil
}

func numericInt(value any) int {
	switch number := value.(type) {
	case int:
		return number
	case int64:
		return int(number)
	case float64:
		return int(number)
	default:
		return 0
	}
}
