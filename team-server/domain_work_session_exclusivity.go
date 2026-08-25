package main

import (
	"context"
	"database/sql"
)

func lockAccountWorkSessions(ctx context.Context, tx *sql.Tx, accountID string) error {
	var lockedAccountID string
	return tx.QueryRowContext(ctx, `SELECT id FROM accounts WHERE id = ? FOR UPDATE`, accountID).Scan(&lockedAccountID)
}

func endOtherAccountActiveWorkSessions(ctx context.Context, tx *sql.Tx, auth authContext, keepSessionID string, now string) error {
	rows, err := tx.QueryContext(
		ctx,
		`SELECT workspace_id, 'work_session' AS entity, id, account_id, updated_at, payload
		 FROM business_work_sessions
		 WHERE account_id = ? AND status IN ('active', 'paused')
		 FOR UPDATE`,
		auth.AccountID,
	)
	if err != nil {
		return err
	}
	sessions, err := scanBusinessRows(rows)
	_ = rows.Close()
	if err != nil {
		return err
	}

	for _, session := range sessions {
		if session.ID == keepSessionID {
			continue
		}
		payload, err := rowPayloadObject(session)
		if err != nil {
			return err
		}
		payload["status"] = "ended"
		payload["endedAt"] = now
		payload["outcome"] = "superseded"
		if err := savePayloadObject(ctx, tx, session, payload, now); err != nil {
			return err
		}
		if err := createExecutionSignal(ctx, tx, auth, session.WorkspaceID, payload, "work_ended", now); err != nil {
			return err
		}

		focusID := stringField(session.Payload, "focusSessionId")
		if focusID == "" {
			continue
		}
		focus, found, err := businessExistingRowForUpdate(ctx, tx, session.WorkspaceID, "focus_session", focusID)
		if err != nil {
			return err
		}
		if !found {
			continue
		}
		focusPayload, err := rowPayloadObject(focus)
		if err != nil {
			return err
		}
		focusPayload["endedAt"] = now
		focusPayload["outcome"] = "superseded"
		if err := savePayloadObject(ctx, tx, focus, focusPayload, now); err != nil {
			return err
		}
	}
	return nil
}

func endAccountActiveWorkSessionsForStart(ctx context.Context, tx *sql.Tx, auth authContext, now string) error {
	if err := lockAccountWorkSessions(ctx, tx, auth.AccountID); err != nil {
		return err
	}
	return endOtherAccountActiveWorkSessions(ctx, tx, auth, "", now)
}
