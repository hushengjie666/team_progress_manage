package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleSwitchWorkspaceMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	var req workspaceSwitchRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	workspaceID := strings.TrimSpace(req.WorkspaceID)
	if workspaceID == "" {
		writeError(w, http.StatusBadRequest, "workspace_id is required")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	account, found, err := mysqlAccountByID(ctx, a.db, auth.AccountID)
	if err != nil || !found || account.DisabledAt != "" {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, found, err := mysqlWorkspaceVisibleToAccount(ctx, a.db, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if !found {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	account.WorkspaceID = workspace.ID
	account.UpdatedAt = time.Now().UTC().Format(time.RFC3339)
	result, err := a.db.ExecContext(ctx, `UPDATE accounts SET workspace_id = ?, updated_at = ? WHERE id = ?`, account.WorkspaceID, account.UpdatedAt, account.ID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		writeError(w, http.StatusNotFound, "account not found")
		return
	}
	a.writeLoginResponse(w, account, workspace)
}
