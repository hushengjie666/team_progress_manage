package main

import (
	"context"
	"database/sql"
	"encoding/json"
	"reflect"
	"strings"
)

func businessRowMutationAllowed(ctx context.Context, q sqlRunner, auth authContext, current businessRow, next businessRow, deleting bool) (bool, error) {
	row := next
	if deleting {
		row = current
	}
	workspace, fullAccess, err := mysqlWorkspaceVisibleToAccount(ctx, q, auth.AccountID, row.WorkspaceID)
	if err != nil {
		return false, err
	}
	canManageWorkspace, err := teamAccountCanManageWorkspace(ctx, q, auth, row.WorkspaceID)
	if err != nil {
		return false, err
	}
	switch row.Entity {
	case "daily_plan", "focus_session", "work_session", "execution_signal", "interruption", "reward_state":
		if row.AccountID != auth.AccountID {
			return false, nil
		}
		return businessPersonalRowTaskRefsAllowed(ctx, q, auth, row)
	case "task_template", "template_instance":
		return fullAccess && workspace.ID != "", nil
	case "project_member":
		projectID := businessProjectID(row)
		if canManageWorkspace {
			return true, nil
		}
		if current.ID == "" && businessAccountRef(row) == auth.AccountID && hasRole(row.Payload, "project_owner") {
			project, found, err := businessExistingRow(ctx, q, row.WorkspaceID, "project", projectID)
			if err != nil {
				return false, err
			}
			if found && project.AccountID == auth.AccountID {
				return true, nil
			}
		}
		return teamAccountCanManageProjectMembers(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
	case "project":
		if current.ID == "" {
			return fullAccess, nil
		}
		if canManageWorkspace {
			return true, nil
		}
		return teamAccountCanManageProjectMembers(ctx, q, row.WorkspaceID, auth.AccountID, row.ID)
	case "task":
		projectID := businessProjectID(row)
		allowed, err := businessAccountCanAccessProject(ctx, q, auth, row.WorkspaceID, projectID)
		if err != nil || !allowed {
			return allowed, err
		}
		if current.ID != "" && businessReviewFieldsChanged(current.Payload, next.Payload) {
			if canManageWorkspace {
				return true, nil
			}
			return teamAccountCanManageProjectMembers(ctx, q, row.WorkspaceID, auth.AccountID, projectID)
		}
		return true, nil
	default:
		return false, nil
	}
}

func businessAccountCanAccessProject(ctx context.Context, q sqlRunner, auth authContext, workspaceID string, projectID string) (bool, error) {
	if _, found, err := mysqlWorkspaceVisibleToAccount(ctx, q, auth.AccountID, workspaceID); err != nil || found {
		return found, err
	}
	return teamAccountCanAccessProject(ctx, q, workspaceID, auth.AccountID, projectID)
}

func businessReviewFieldsChanged(current json.RawMessage, next json.RawMessage) bool {
	var currentValue map[string]any
	var nextValue map[string]any
	if json.Unmarshal(current, &currentValue) != nil || json.Unmarshal(next, &nextValue) != nil {
		return true
	}
	for _, field := range []string{"reviewSubmittedAt", "reviewSubmittedByMemberId", "reviewAcceptedAt", "reviewAcceptedByMemberId", "reviewReturnedAt", "reviewReturnedByMemberId", "reviewReturnReason"} {
		if !reflect.DeepEqual(currentValue[field], nextValue[field]) {
			return true
		}
	}
	return false
}

func businessPersonalRowTaskRefsAllowed(ctx context.Context, q sqlRunner, auth authContext, row businessRow) (bool, error) {
	for _, taskID := range businessReferencedTaskIDs(row) {
		projectID, err := mysqlBusinessTaskProjectID(ctx, q, row.WorkspaceID, taskID)
		if err != nil {
			return false, err
		}
		allowed, err := businessAccountCanAccessProject(ctx, q, auth, row.WorkspaceID, projectID)
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

func mysqlBusinessTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	var projectID string
	err := q.QueryRowContext(ctx, `SELECT project_id FROM business_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return projectID, err
}
