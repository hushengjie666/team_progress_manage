package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"time"
)

func loadAccountSettingsContext(r *http.Request, q sqlRunner, accountID string) (map[string]any, error) {
	var raw []byte
	err := q.QueryRowContext(r.Context(), `SELECT payload FROM account_settings WHERE account_id = ?`, accountID).Scan(&raw)
	if errors.Is(err, sql.ErrNoRows) {
		return map[string]any{}, nil
	}
	if err != nil {
		return nil, err
	}
	value := map[string]any{}
	if err := json.Unmarshal(raw, &value); err != nil {
		return nil, err
	}
	return value, nil
}

func (a *app) handleAccountSettings(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet && r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	current, err := loadAccountSettingsContext(r, a.db, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load settings failed")
		return
	}
	if r.Method == http.MethodGet {
		writeJSON(w, http.StatusOK, map[string]any{"settings": current})
		return
	}
	patch, ok := decodeObject(w, r)
	if !ok {
		return
	}
	for key, value := range patch {
		current[key] = value
	}
	ctx, recorder := withMutationRecorder(r.Context(), mutationIDFromRequest(r))
	r = r.WithContext(ctx)
	tx, err := a.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save settings failed")
		return
	}
	defer mysqlRollback(tx)
	if !a.claimIdempotencyOrRespond(w, r, tx, auth) {
		return
	}
	raw, _ := json.Marshal(current)
	now := time.Now().UTC().Format(time.RFC3339Nano)
	_, err = tx.ExecContext(r.Context(), `INSERT INTO account_settings (account_id, payload, updated_at) VALUES (?, ?, ?)
		ON DUPLICATE KEY UPDATE payload = VALUES(payload), updated_at = VALUES(updated_at)`, auth.AccountID, raw, now)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save settings failed")
		return
	}
	recorder.recordSettings(current)
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}
