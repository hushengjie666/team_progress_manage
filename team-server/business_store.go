package main

import (
	"context"
	"database/sql"
	"fmt"
)

func scanBusinessRows(rows *sql.Rows) ([]businessRow, error) {
	result := []businessRow{}
	for rows.Next() {
		var row businessRow
		var accountID sql.NullString
		if err := rows.Scan(&row.WorkspaceID, &row.Entity, &row.ID, &accountID, &row.UpdatedAt, &row.Payload); err != nil {
			return result, err
		}
		if accountID.Valid {
			row.AccountID = accountID.String
		}
		result = append(result, row)
	}
	return result, rows.Err()
}

func businessLoadRows(ctx context.Context, q sqlRunner, workspaceID string) ([]businessRow, error) {
	result := []businessRow{}
	for _, spec := range businessEntityTables {
		query := fmt.Sprintf(
			`SELECT workspace_id, '%s' AS entity, id, account_id, updated_at, payload
			 FROM %s WHERE workspace_id = ? ORDER BY updated_at ASC`,
			spec.entity,
			spec.table,
		)
		rows, err := q.QueryContext(ctx, query, workspaceID)
		if err != nil {
			return result, err
		}
		items, scanErr := scanBusinessRows(rows)
		closeErr := rows.Close()
		if scanErr != nil {
			return result, scanErr
		}
		if closeErr != nil {
			return result, closeErr
		}
		result = append(result, items...)
	}
	return result, nil
}

func businessLoadRowsByColumn(ctx context.Context, q sqlRunner, spec businessEntityTable, workspaceID string, column string, values []string) ([]businessRow, error) {
	values = teamUniqueStrings(values)
	if len(values) == 0 {
		return nil, nil
	}
	args := make([]any, 0, len(values)+1)
	args = append(args, workspaceID)
	for _, value := range values {
		args = append(args, value)
	}
	query := fmt.Sprintf(
		`SELECT workspace_id, '%s' AS entity, id, account_id, updated_at, payload
		 FROM %s WHERE workspace_id = ? AND %s IN (%s) ORDER BY updated_at ASC`,
		spec.entity,
		spec.table,
		column,
		teamPlaceholders(len(values)),
	)
	rows, err := q.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	return scanBusinessRows(rows)
}

func businessLoadDailyPlanRowsForProjects(ctx context.Context, q sqlRunner, workspaceID string, taskIDs []string, accountID string) ([]businessRow, error) {
	taskIDs = teamUniqueStrings(taskIDs)
	taskIDSet := map[string]bool{}
	for _, taskID := range taskIDs {
		taskIDSet[taskID] = true
	}
	dailyPlanSpec, _ := businessTableForEntity("daily_plan")
	query := fmt.Sprintf(
		`SELECT workspace_id, '%s' AS entity, id, account_id, updated_at, payload
		 FROM %s WHERE workspace_id = ? ORDER BY updated_at ASC`,
		dailyPlanSpec.entity,
		dailyPlanSpec.table,
	)
	rows, err := q.QueryContext(ctx, query, workspaceID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items, err := scanBusinessRows(rows)
	if err != nil {
		return nil, err
	}
	result := []businessRow{}
	seen := map[string]bool{}
	for _, row := range items {
		include := row.AccountID == accountID
		for _, taskID := range businessReferencedTaskIDs(row) {
			if taskIDSet[taskID] {
				include = true
				break
			}
		}
		if include && !seen[businessRowKey(row)] {
			result = append(result, row)
			seen[businessRowKey(row)] = true
		}
	}
	return result, nil
}

func businessLoadRowsForProjects(ctx context.Context, q sqlRunner, workspaceID string, projectIDs []string, accountID string) ([]businessRow, error) {
	projectIDs = teamUniqueStrings(projectIDs)
	rewardStateSpec, _ := businessTableForEntity("reward_state")
	personalRows := []businessRow{}
	if accountID != "" {
		rewardStateRows, err := businessLoadRowsByColumn(ctx, q, rewardStateSpec, workspaceID, "account_id", []string{accountID})
		if err != nil {
			return nil, err
		}
		personalRows = append(personalRows, rewardStateRows...)
	}
	if len(projectIDs) == 0 {
		return personalRows, nil
	}
	projectSpec, _ := businessTableForEntity("project")
	projectMemberSpec, _ := businessTableForEntity("project_member")
	taskSpec, _ := businessTableForEntity("task")
	workSessionSpec, _ := businessTableForEntity("work_session")
	executionSignalSpec, _ := businessTableForEntity("execution_signal")
	focusSessionSpec, _ := businessTableForEntity("focus_session")
	interruptionSpec, _ := businessTableForEntity("interruption")

	projectRows, err := businessLoadRowsByColumn(ctx, q, projectSpec, workspaceID, "id", projectIDs)
	if err != nil {
		return nil, err
	}
	projectMemberRows, err := businessLoadRowsByColumn(ctx, q, projectMemberSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}
	taskRows, err := businessLoadRowsByColumn(ctx, q, taskSpec, workspaceID, "project_id", projectIDs)
	if err != nil {
		return nil, err
	}
	taskIDs := []string{}
	for _, row := range taskRows {
		taskIDs = append(taskIDs, row.ID)
	}
	dailyPlanRows, err := businessLoadDailyPlanRowsForProjects(ctx, q, workspaceID, taskIDs, accountID)
	if err != nil {
		return nil, err
	}
	workSessionRows, err := businessLoadRowsByColumn(ctx, q, workSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	executionSignalRows, err := businessLoadRowsByColumn(ctx, q, executionSignalSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	focusSessionRows, err := businessLoadRowsByColumn(ctx, q, focusSessionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	interruptionRows, err := businessLoadRowsByColumn(ctx, q, interruptionSpec, workspaceID, "task_id", taskIDs)
	if err != nil {
		return nil, err
	}
	return append(append(append(append(append(append(append(append(projectRows, projectMemberRows...), taskRows...), dailyPlanRows...), workSessionRows...), executionSignalRows...), focusSessionRows...), interruptionRows...), personalRows...), nil
}

func businessUpsertRow(ctx context.Context, tx *sql.Tx, row businessRow) error {
	spec, ok := businessTableForEntity(row.Entity)
	if !ok {
		return nil
	}
	payload := row.Payload
	if len(payload) == 0 {
		payload = []byte(`{}`)
	}
	_, err := tx.ExecContext(
		ctx,
		fmt.Sprintf(`INSERT INTO %s
			(workspace_id, id, account_id, project_id, task_id, account_ref, status, kind, row_date, updated_at, payload)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				account_id = VALUES(account_id),
				project_id = VALUES(project_id),
				task_id = VALUES(task_id),
				account_ref = VALUES(account_ref),
				status = VALUES(status),
				kind = VALUES(kind),
				row_date = VALUES(row_date),
				updated_at = VALUES(updated_at),
				payload = VALUES(payload)`, spec.table),
		row.WorkspaceID,
		row.ID,
		nullString(row.AccountID),
		nullString(businessProjectID(row)),
		nullString(businessTaskID(row)),
		nullString(businessAccountRef(row)),
		nullString(businessStatus(row)),
		nullString(businessKind(row)),
		nullString(businessRowDate(row)),
		row.UpdatedAt,
		payload,
	)
	return err
}

func businessDeleteRow(ctx context.Context, tx *sql.Tx, row businessRow) error {
	spec, ok := businessTableForEntity(row.Entity)
	if !ok {
		return nil
	}
	_, err := tx.ExecContext(ctx, fmt.Sprintf(`DELETE FROM %s WHERE workspace_id = ? AND id = ?`, spec.table), row.WorkspaceID, row.ID)
	return err
}
