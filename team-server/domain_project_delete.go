package main

import (
	"context"
	"database/sql"
	"fmt"
	"net/http"
)

// The caller checks project management permission and locks the project before
// removing its dependents. All cleanup shares the parent deletion transaction.
func cleanupProjectReferencesForDelete(ctx context.Context, tx *sql.Tx, project businessRow, now string) error {
	tasks, err := projectDeletionRows(ctx, tx, project.WorkspaceID, "task", "project_id", []string{project.ID})
	if err != nil {
		return err
	}
	taskIDs := []string{}
	for _, task := range tasks {
		taskIDs = append(taskIDs, task.ID)
		if err := cleanupTaskReferencesForDelete(ctx, tx, task, now); err != nil {
			return err
		}
	}
	work, err := projectDeletionRows(ctx, tx, project.WorkspaceID, "work_session", "task_id", taskIDs)
	if err != nil {
		return err
	}
	focusIDs, workIDs := []string{}, []string{}
	for _, session := range work {
		workIDs = append(workIDs, session.ID)
		if id := stringField(session.Payload, "focusSessionId"); id != "" {
			focusIDs = append(focusIDs, id)
		}
	}
	focus, err := projectDeletionRows(ctx, tx, project.WorkspaceID, "focus_session", "task_id", taskIDs)
	if err != nil {
		return err
	}
	for _, session := range focus {
		focusIDs = append(focusIDs, session.ID)
	}
	for _, group := range []struct {
		entity string
		column string
		ids    []string
	}{
		{"execution_signal", "task_id", taskIDs},
		{"execution_signal", "core_work_session_id", workIDs},
		{"interruption", "task_id", taskIDs},
		{"interruption", "core_session_id", focusIDs},
		{"template_instance", "task_id", taskIDs},
		{"focus_session", "id", focusIDs},
		{"work_session", "task_id", taskIDs},
		{"task", "project_id", []string{project.ID}},
		{"project_member", "project_id", []string{project.ID}},
	} {
		rows, err := projectDeletionRows(ctx, tx, project.WorkspaceID, group.entity, group.column, group.ids)
		if err != nil {
			return err
		}
		for _, row := range rows {
			if _, err := businessDeleteRow(ctx, tx, row); err != nil {
				return err
			}
		}
	}
	_, err = tx.ExecContext(ctx, `DELETE FROM project_invitations WHERE workspace_id = ? AND project_id = ?`, project.WorkspaceID, project.ID)
	return err
}

// Serialize child creation with project/task deletion, and reject a parent that
// disappeared while permission checks were running.
func lockBusinessParentsForCreate(ctx context.Context, tx *sql.Tx, row businessRow) businessMutationFailure {
	parentEntity := "task"
	ids := businessReferencedTaskIDs(row)
	if row.Entity == "task" || row.Entity == "project_member" {
		parentEntity = "project"
		ids = []string{businessProjectID(row)}
	}
	for _, id := range teamUniqueStrings(ids) {
		_, found, err := businessExistingRowForUpdate(ctx, tx, row.WorkspaceID, parentEntity, id)
		if err != nil {
			return businessMutationFailure{status: http.StatusInternalServerError, message: "parent lookup failed"}
		}
		if !found {
			return businessMutationFailure{status: http.StatusConflict, message: "parent " + parentEntity + " no longer exists"}
		}
	}
	return businessMutationFailure{}
}

func projectDeletionRows(ctx context.Context, tx *sql.Tx, workspaceID, entity, column string, ids []string) ([]businessRow, error) {
	ids = teamUniqueStrings(ids)
	if len(ids) == 0 {
		return nil, nil
	}
	spec, ok := businessTableForEntity(entity)
	if !ok {
		return nil, fmt.Errorf("unsupported project dependent %q", entity)
	}
	args := []any{workspaceID}
	for _, id := range ids {
		args = append(args, id)
	}
	rows, err := tx.QueryContext(ctx, fmt.Sprintf(
		`SELECT workspace_id, '%s' AS entity, id, account_id, updated_at, %s FROM %s WHERE workspace_id = ? AND %s IN (%s) ORDER BY id FOR UPDATE`,
		entity, businessCorePayloadSQL(entity, ""), spec.table, column, teamPlaceholders(len(ids))), args...)
	if err != nil {
		return nil, err
	}
	return scanBusinessRows(ctx, tx, rows)
}
