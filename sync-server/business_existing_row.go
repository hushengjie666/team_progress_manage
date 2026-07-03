package main

import "context"

func businessExistingRow(ctx context.Context, q sqlRunner, workspaceID string, entity string, id string) (businessRow, bool, error) {
	spec, ok := businessTableForEntity(entity)
	if !ok || id == "" {
		return businessRow{}, false, nil
	}
	rows, err := businessLoadRowsByColumn(ctx, q, spec, workspaceID, "id", []string{id})
	if err != nil {
		return businessRow{}, false, err
	}
	if len(rows) == 0 {
		return businessRow{}, false, nil
	}
	return rows[0], true, nil
}
