package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleLoginMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req loginRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(firstNonEmpty(req.Email, req.Username))
	if email == "" {
		writeError(w, http.StatusBadRequest, "email is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByEmail(ctx, a.db, email)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	if !found || account.DisabledAt != "" || !checkPassword(req.Password, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid email or password")
		return
	}
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	defer mysqlRollback(tx)
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := mysqlEnsurePrivateWorkspaceForAccount(ctx, tx, account, now); err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	workspace, found, err := mysqlDefaultWorkspaceForAccount(ctx, tx, account)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace not found")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "login failed")
		return
	}
	a.writeLoginResponse(w, account, workspace)
}
