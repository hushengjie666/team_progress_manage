package main

import (
	"context"
	"database/sql"
	"encoding/json"
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
		var status int
		var body []byte
		err := tx.QueryRowContext(
			r.Context(),
			`SELECT response_status, response_body FROM idempotency_keys WHERE account_id = ? AND idempotency_key = ?`,
			auth.AccountID,
			strings.TrimSpace(r.Header.Get("Idempotency-Key")),
		).Scan(&status, &body)
		_ = tx.Rollback()
		if err != nil || len(body) == 0 || string(body) == "{}" {
			writeError(w, http.StatusConflict, "idempotent response is not available")
			return false
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-TimeManage-Idempotency-Replayed", "true")
		w.WriteHeader(status)
		_, _ = w.Write(body)
		return false
	}
	return true
}

func (a *app) commitMutation(w http.ResponseWriter, r *http.Request, tx *sql.Tx, auth authContext, status int, recorder *mutationRecorder) bool {
	payload := recorder.response()
	body, err := json.Marshal(payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return false
	}
	key := strings.TrimSpace(r.Header.Get("Idempotency-Key"))
	if key != "" {
		result, updateErr := tx.ExecContext(
			r.Context(),
			`UPDATE idempotency_keys SET response_status = ?, response_body = ? WHERE account_id = ? AND idempotency_key = ?`,
			status,
			body,
			auth.AccountID,
			key,
		)
		if updateErr != nil {
			writeError(w, http.StatusInternalServerError, "save failed")
			return false
		}
		if count, countErr := result.RowsAffected(); countErr != nil || count != 1 {
			writeError(w, http.StatusInternalServerError, "save failed")
			return false
		}
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return false
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_, _ = w.Write(append(body, '\n'))
	a.broadcastMutation(auth, payload)
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
