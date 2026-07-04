package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleBootstrapMySQL(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req bootstrapRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.DeviceID) == "" {
		writeError(w, http.StatusBadRequest, "device_id is required")
		return
	}
	email := normalizeEmail(req.Email)
	if email == "" || strings.TrimSpace(req.Password) == "" {
		writeError(w, http.StatusBadRequest, "email and password are required")
		return
	}
	hash, err := hashPassword(req.Password)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}

	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	count, err := mysqlAccountCount(ctx, tx)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if count > 0 {
		writeError(w, http.StatusConflict, "workspace already bootstrapped")
		return
	}

	now := time.Now().UTC().Format(time.RFC3339)
	accountID := newID("account")
	accountName := strings.TrimSpace(req.Name)
	if accountName == "" {
		writeError(w, http.StatusBadRequest, "name is required")
		return
	}
	workspaceName := strings.TrimSpace(req.WorkspaceName)
	if workspaceName == "" {
		writeError(w, http.StatusBadRequest, "workspace_name is required")
		return
	}
	workspace := workspaceData{
		ID:             privateWorkspaceID(accountID),
		Name:           workspaceName,
		Type:           "private",
		OwnerAccountID: accountID,
		CreatedAt:      now,
		UpdatedAt:      now,
	}
	account := accountRecord{ID: accountID, WorkspaceID: workspace.ID, Name: accountName, Email: email, PasswordHash: hash, CreatedAt: now, UpdatedAt: now}
	if err := mysqlUpsertWorkspace(ctx, tx, workspace); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, workspace.ID, account.ID, "owner", "active", now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	a.writeLoginResponse(w, account, workspace)
}
