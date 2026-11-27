package main

import (
	"database/sql"
	"encoding/json"
	"errors"
	"math"
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
	if value == nil {
		value = map[string]any{}
	}
	return value, nil
}

func (a *app) handleAccountSettings(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodGet && r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if r.Method == http.MethodGet {
		current, err := loadAccountSettingsContext(r, a.db, auth.AccountID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load settings failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]any{"settings": current})
		return
	}
	patch, ok := decodeObject(w, r)
	if !ok {
		return
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
	now := time.Now().UTC().Format(time.RFC3339Nano)
	// Establish and lock the row before reading it so concurrent PATCHes of different settings cannot lose changes.
	_, err = tx.ExecContext(r.Context(), `INSERT INTO account_settings (account_id, payload, updated_at) VALUES (?, JSON_OBJECT(), ?)
		ON DUPLICATE KEY UPDATE account_id = account_id`, auth.AccountID, now)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save settings failed")
		return
	}
	current, err := loadAccountSettingsContext(r, tx, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load settings failed")
		return
	}
	if next, ok := patch["focusPet"]; ok && !nextPetRevision(current["focusPet"], next) {
		writeError(w, http.StatusConflict, "宠物状态已在其他设备更新")
		return
	}
	for key, value := range patch {
		current[key] = value
	}
	raw, _ := json.Marshal(current)
	_, err = tx.ExecContext(r.Context(), `UPDATE account_settings SET payload = ?, updated_at = ? WHERE account_id = ?`, raw, now, auth.AccountID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save settings failed")
		return
	}
	recorder.recordSettings(patch)
	a.commitMutation(w, r, tx, auth, http.StatusOK, recorder)
}

// Called with the account settings row locked inside the PATCH transaction.
func nextPetRevision(current, next any) bool {
	revision := func(value any) float64 {
		object, _ := value.(map[string]any)
		number, ok := object["revision"].(float64)
		if !ok || number < 1 || number > 9007199254740991 || number != math.Trunc(number) {
			return -1
		}
		return number
	}
	if current == nil {
		return revision(next) == 1
	}
	before := revision(current)
	return before > 0 && revision(next) == before+1
}
