package main

import "context"

func teamExistingRow(ctx context.Context, q sqlRunner, workspaceID string, entity string, id string) (syncRow, bool, error) {
	spec, ok := teamTableForEntity(entity)
	if !ok || id == "" {
		return syncRow{}, false, nil
	}
	rows, err := teamLoadRowsByColumn(ctx, q, spec, workspaceID, "id", []string{id})
	if err != nil {
		return syncRow{}, false, err
	}
	if len(rows) == 0 {
		return syncRow{}, false, nil
	}
	return rows[0], true, nil
}
