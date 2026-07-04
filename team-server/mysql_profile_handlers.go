package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleMeMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, account.ID, auth.WorkspaceID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace access denied")
		return
	}
	publicAccount := account
	publicAccount.PasswordHash = ""
	membership, found, err := mysqlMembershipSummaryByAccountAndWorkspace(ctx, a.db, account.ID, workspace.ID)
	if err != nil || !found {
		writeError(w, http.StatusUnauthorized, "workspace access denied")
		return
	}
	workspaces, err := mysqlWorkspaceSummariesForAccount(ctx, a.db, account.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspaces failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"account":    publicAccount,
		"workspace":  publicWorkspace(workspace),
		"membership": membership,
		"workspaces": workspaces,
	})
}

func (a *app) handleChangePasswordMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req changePasswordRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if strings.TrimSpace(req.NewPassword) == "" {
		writeError(w, http.StatusBadRequest, "new_password is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found || !checkPassword(req.OldPassword, account.PasswordHash) {
		writeError(w, http.StatusUnauthorized, "invalid password")
		return
	}
	hash, err := hashPassword(req.NewPassword)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "password hashing failed")
		return
	}
	account.PasswordHash = hash
	account.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	if err := mysqlUpsertAccount(ctx, tx, account); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
}
