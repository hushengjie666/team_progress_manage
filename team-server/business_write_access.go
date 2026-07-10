package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"reflect"
	"strings"
)

func businessRowsByKey(rows []businessRow) map[string]businessRow {
	result := make(map[string]businessRow, len(rows))
	for _, row := range rows {
		result[businessRowKey(row)] = row
	}
	return result
}

func businessRowsEquivalentForSave(current businessRow, submitted businessRow) bool {
	if current.WorkspaceID != submitted.WorkspaceID || current.AccountID != submitted.AccountID ||
		current.Entity != submitted.Entity || current.ID != submitted.ID || current.UpdatedAt != submitted.UpdatedAt {
		return false
	}
	current.Payload = businessPayloadWithWorkspaceID(current.Entity, current.Payload, current.WorkspaceID)
	var currentValue any
	var submittedValue any
	if json.Unmarshal(current.Payload, &currentValue) != nil || json.Unmarshal(submitted.Payload, &submittedValue) != nil {
		return false
	}
	return reflect.DeepEqual(currentValue, submittedValue)
}

func businessRowWritableByProjectAccess(ctx context.Context, q sqlRunner, auth authContext, row businessRow, submittedTaskProjects map[string]string) (bool, error) {
	if businessPersonalRowOwnedByAccount(row, auth.AccountID) {
		return businessPersonalRowTaskRefsAllowed(ctx, q, auth, row, submittedTaskProjects)
	}
	projectID, err := businessProjectIDForWriteRow(ctx, q, row.WorkspaceID, row, submittedTaskProjects)
	if err != nil {
		return false, err
	}
	return teamAccountCanAccessProject(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
}

func businessPersonalRowOwnedByAccount(row businessRow, accountID string) bool {
	if row.Entity != "daily_plan" && row.Entity != "reward_state" {
		return false
	}
	rowAccountID := firstNonEmpty(row.AccountID, stringField(row.Payload, "ownerAccountId"), stringField(row.Payload, "accountId"))
	return strings.TrimSpace(rowAccountID) == strings.TrimSpace(accountID)
}

func businessPersonalRowTaskRefsAllowed(ctx context.Context, q sqlRunner, auth authContext, row businessRow, submittedTaskProjects map[string]string) (bool, error) {
	for _, taskID := range businessReferencedTaskIDs(row) {
		projectID, err := businessProjectIDForTask(ctx, q, row.WorkspaceID, taskID, submittedTaskProjects)
		if err != nil {
			return false, err
		}
		allowed, err := teamAccountCanAccessProject(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
		if err != nil || !allowed {
			return allowed, err
		}
	}
	return true, nil
}

func businessReferencedTaskIDs(row businessRow) []string {
	ids := []string{}
	if taskID := businessTaskID(row); taskID != "" {
		ids = append(ids, taskID)
	}
	for _, field := range []string{"committedTaskIds", "suggestedTaskIds"} {
		ids = append(ids, stringSliceField(row.Payload, field)...)
	}
	return teamUniqueStrings(ids)
}

func stringSliceField(payload json.RawMessage, field string) []string {
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return nil
	}
	raw, ok := value[field].([]any)
	if !ok {
		return nil
	}
	result := []string{}
	for _, item := range raw {
		if text, ok := item.(string); ok && strings.TrimSpace(text) != "" {
			result = append(result, strings.TrimSpace(text))
		}
	}
	return result
}

func businessProjectIDForWriteRow(ctx context.Context, q sqlRunner, workspaceID string, row businessRow, submittedTaskProjects map[string]string) (string, error) {
	if projectID := businessProjectID(row); projectID != "" {
		return projectID, nil
	}
	if taskID := businessTaskID(row); taskID != "" {
		return businessProjectIDForTask(ctx, q, workspaceID, taskID, submittedTaskProjects)
	}
	return "", nil
}

func businessProjectIDForTask(ctx context.Context, q sqlRunner, workspaceID string, taskID string, submittedTaskProjects map[string]string) (string, error) {
	if projectID := submittedTaskProjects[businessTaskWorkspaceKey(workspaceID, taskID)]; projectID != "" {
		return projectID, nil
	}
	return mysqlBusinessTaskProjectID(ctx, q, workspaceID, taskID)
}

func mysqlBusinessTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	var projectID string
	err := q.QueryRowContext(ctx, `SELECT project_id FROM business_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return projectID, err
}
