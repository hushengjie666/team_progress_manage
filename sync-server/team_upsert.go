package main

import (
	"context"
	"database/sql"
	"fmt"
)

func teamUpsertRow(ctx context.Context, tx *sql.Tx, row syncRow) error {
	spec, ok := teamTableForEntity(row.Entity)
	if !ok {
		return nil
	}
	payload := row.Payload
	if len(payload) == 0 {
		payload = []byte(`{}`)
	}
	_, err := tx.ExecContext(
		ctx,
		fmt.Sprintf(`INSERT INTO %s
			(workspace_id, id, user_id, account_id, device_id, project_id, task_id, account_ref, status, kind, row_date, updated_at, deleted_at, version, revision, payload)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			ON DUPLICATE KEY UPDATE
				user_id = VALUES(user_id),
				account_id = VALUES(account_id),
				device_id = VALUES(device_id),
				project_id = VALUES(project_id),
				task_id = VALUES(task_id),
				account_ref = VALUES(account_ref),
				status = VALUES(status),
				kind = VALUES(kind),
				row_date = VALUES(row_date),
				updated_at = VALUES(updated_at),
				deleted_at = VALUES(deleted_at),
				version = VALUES(version),
				revision = VALUES(revision),
				payload = VALUES(payload)`, spec.table),
		row.WorkspaceID,
		row.ID,
		nullString(row.UserID),
		nullString(row.AccountID),
		row.DeviceID,
		nullString(teamProjectID(row)),
		nullString(teamTaskID(row)),
		nullString(teamAccountRef(row)),
		nullString(teamStatus(row)),
		nullString(teamKind(row)),
		nullString(teamRowDate(row)),
		row.UpdatedAt,
		nullString(row.DeletedAt),
		row.Version,
		row.Revision,
		payload,
	)
	return err
}
