package main

import (
	"context"
	"database/sql"
	"errors"
	"strings"
)

func teamTaskProjectID(ctx context.Context, q sqlRunner, workspaceID string, taskID string) (string, error) {
	if strings.TrimSpace(taskID) == "" {
		return "", nil
	}
	var projectID sql.NullString
	err := q.QueryRowContext(ctx, `SELECT project_id FROM team_tasks WHERE workspace_id = ? AND id = ?`, workspaceID, taskID).Scan(&projectID)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	if projectID.Valid {
		return projectID.String, nil
	}
	return "", nil
}

func teamProjectIDForWriteRow(ctx context.Context, q sqlRunner, workspaceID string, row syncRow) (string, error) {
	if projectID := teamProjectID(row); projectID != "" {
		return projectID, nil
	}
	if existing, found, err := teamExistingRow(ctx, q, workspaceID, row.Entity, row.ID); err != nil {
		return "", err
	} else if found {
		if projectID := teamProjectID(existing); projectID != "" {
			return projectID, nil
		}
		if taskID := teamTaskID(existing); taskID != "" {
			return teamTaskProjectID(ctx, q, workspaceID, taskID)
		}
	}
	if taskID := teamTaskID(row); taskID != "" {
		return teamTaskProjectID(ctx, q, workspaceID, taskID)
	}
	return "", nil
}

func teamWorkspaceIDForChange(auth authContext, change syncRow) string {
	if value := strings.TrimSpace(change.WorkspaceID); value != "" {
		return value
	}
	if value := stringField(change.Payload, "workspaceId"); value != "" {
		return value
	}
	return auth.WorkspaceID
}
