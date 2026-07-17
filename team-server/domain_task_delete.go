package main

import (
	"context"
	"database/sql"
)

func cleanupTaskReferencesForDelete(ctx context.Context, tx *sql.Tx, task businessRow, now string) error {
	if err := endTaskWorkSessionsInTx(ctx, tx, task, now, "task_deleted"); err != nil {
		return err
	}
	rows, err := tx.QueryContext(
		ctx,
		`SELECT workspace_id, 'daily_plan' AS entity, id, account_id, updated_at, payload
		 FROM business_daily_plans
		 WHERE workspace_id = ?
		 FOR UPDATE`,
		task.WorkspaceID,
	)
	if err != nil {
		return err
	}
	plans, err := scanBusinessRows(rows)
	_ = rows.Close()
	if err != nil {
		return err
	}
	for _, plan := range plans {
		payload, err := rowPayloadObject(plan)
		if err != nil {
			return err
		}
		changed := false
		for _, field := range []string{"committedTaskIds", "suggestedTaskIds"} {
			ids := stringSliceField(plan.Payload, field)
			next := make([]string, 0, len(ids))
			for _, id := range ids {
				if id == task.ID {
					changed = true
					continue
				}
				next = append(next, id)
			}
			payload[field] = next
		}
		if changed {
			if err := savePayloadObject(ctx, tx, plan, payload, now); err != nil {
				return err
			}
		}
	}
	return nil
}
