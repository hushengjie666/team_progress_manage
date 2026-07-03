package main

import (
	"context"
	"fmt"
)

func teamLoadRows(ctx context.Context, q sqlRunner, workspaceID string) ([]syncRow, error) {
	return teamLoadRowsWithOptions(ctx, q, workspaceID, true)
}

func teamLoadRowsWithOptions(ctx context.Context, q sqlRunner, workspaceID string, includeSingletons bool) ([]syncRow, error) {
	result := []syncRow{}
	for _, spec := range teamEntityTables {
		if !includeSingletons && teamSingletonEntities[spec.entity] {
			continue
		}
		query := fmt.Sprintf(
			`SELECT workspace_id, '%s' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
			 FROM %s WHERE workspace_id = ? ORDER BY revision ASC`,
			spec.entity,
			spec.table,
		)
		rows, err := q.QueryContext(ctx, query, workspaceID)
		if err != nil {
			return result, err
		}
		items, scanErr := scanSyncRows(rows)
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

func teamLoadRowsByColumn(ctx context.Context, q sqlRunner, spec teamEntityTable, workspaceID string, column string, values []string) ([]syncRow, error) {
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
		`SELECT workspace_id, '%s' AS entity, id, user_id, account_id, device_id, updated_at, deleted_at, version, revision, payload
		 FROM %s WHERE workspace_id = ? AND %s IN (%s) ORDER BY revision ASC`,
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
	return scanSyncRows(rows)
}
