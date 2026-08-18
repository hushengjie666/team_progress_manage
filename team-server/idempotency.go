package main

import (
	"context"
	"database/sql"
	"net/http"
	"strings"
	"time"
)

func (a *app) claimIdempotencyOrRespond(w http.ResponseWriter, r *http.Request, tx *sql.Tx, auth authContext) bool {
	claimed, err := claimIdempotencyKey(r.Context(), tx, auth.AccountID, r.Header.Get("Idempotency-Key"), r.URL.Path)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return false
	}
	if !claimed {
		_ = tx.Rollback()
		a.writeBootstrapRows(w, r, auth)
		return false
	}
	return true
}

func claimIdempotencyKey(ctx context.Context, tx *sql.Tx, accountID string, key string, path string) (bool, error) {
	key = strings.TrimSpace(key)
	if key == "" {
		return true, nil
	}
	result, err := tx.ExecContext(
		ctx,
		`INSERT IGNORE INTO idempotency_keys (account_id, idempotency_key, request_path, response_status, response_body, created_at)
		 VALUES (?, ?, ?, 200, JSON_OBJECT(), ?)`,
		accountID,
		key,
		path,
		time.Now().UTC().Format(time.RFC3339Nano),
	)
	if err != nil {
		return false, err
	}
	count, err := result.RowsAffected()
	return count == 1, err
}
