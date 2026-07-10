package main

import (
	"context"
	"strings"
)

func mysqlProjectRowByID(ctx context.Context, q sqlRunner, workspaceID string, projectID string) (businessRow, bool, error) {
	workspaceID = strings.TrimSpace(workspaceID)
	projectID = strings.TrimSpace(projectID)
	if projectID == "" {
		return businessRow{}, false, nil
	}
	rows, err := q.QueryContext(
		ctx,
		`SELECT workspace_id, 'project' AS entity, id, account_id, updated_at, row_version, payload
		 FROM business_projects
		 WHERE id = ? AND (? = '' OR workspace_id = ?)
		 ORDER BY updated_at DESC
		 LIMIT 1`,
		projectID,
		workspaceID,
		workspaceID,
	)
	if err != nil {
		return businessRow{}, false, err
	}
	defer rows.Close()
	items, err := scanBusinessRows(rows)
	if err != nil {
		return businessRow{}, false, err
	}
	if len(items) == 0 {
		return businessRow{}, false, nil
	}
	return items[0], true, nil
}
