package main

import (
	"context"
	"strings"
)

func mysqlProjectRowByID(ctx context.Context, q sqlRunner, workspaceID string, projectID string) (syncRow, bool, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return syncRow{}, false, nil
	}
	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
		 FROM team_projects
		 WHERE id = ? AND (? = '' OR workspace_id = ?) AND deleted_at IS NULL
		 ORDER BY updated_at DESC
		 LIMIT 1`,
		projectID,
		workspaceID,
		workspaceID,
	)
	if err != nil {
		return syncRow{}, false, err
	}
	defer rows.Close()
	items, err := scanSyncRows(rows)
	if err != nil {
		return syncRow{}, false, err
	}
	if len(items) == 0 {
		return syncRow{}, false, nil
	}
	return items[0], true, nil
}
