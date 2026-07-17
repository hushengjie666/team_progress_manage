package main

import (
	"context"
	"encoding/json"
	"strings"
)

func (a *app) businessRowsForAccount(ctx context.Context, auth authContext) ([]businessRow, error) {
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, auth.AccountID)
	if err != nil {
		return nil, err
	}
	rows := []businessRow{}
	for _, workspace := range workspaces {
		if _, fullAccess, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, workspace.ID); err != nil {
			return nil, err
		} else if fullAccess {
			workspaceRows, err := businessLoadRows(ctx, a.db, workspace.ID)
			if err != nil {
				return nil, err
			}
			rows = append(rows, workspaceRows...)
			continue
		}
		projectIDs, err := teamProjectIDsForAccount(ctx, a.db, workspace.ID, auth.AccountID)
		if err != nil {
			return nil, err
		}
		workspaceRows, err := businessLoadRowsForProjects(ctx, a.db, workspace.ID, projectIDs, auth.AccountID)
		if err != nil {
			return nil, err
		}
		rows = append(rows, workspaceRows...)
	}
	return rows, nil
}

func businessWorkspaceIDForRow(auth authContext, row businessRow) string {
	if strings.TrimSpace(row.WorkspaceID) != "" {
		return strings.TrimSpace(row.WorkspaceID)
	}
	return auth.WorkspaceID
}

func businessPayloadWithWorkspaceID(entity string, payload json.RawMessage, workspaceID string) json.RawMessage {
	if strings.TrimSpace(workspaceID) == "" {
		return payload
	}
	switch entity {
	case "project", "project_member", "task", "daily_plan", "interruption":
	default:
		return payload
	}
	var value map[string]any
	if err := json.Unmarshal(payload, &value); err != nil {
		return payload
	}
	if current, ok := value["workspaceId"].(string); ok && strings.TrimSpace(current) == strings.TrimSpace(workspaceID) {
		return payload
	}
	value["workspaceId"] = strings.TrimSpace(workspaceID)
	next, err := json.Marshal(value)
	if err != nil {
		return payload
	}
	return next
}

func businessRowKey(row businessRow) string {
	return strings.TrimSpace(row.WorkspaceID) + ":" + strings.TrimSpace(row.Entity) + ":" + strings.TrimSpace(row.ID)
}
