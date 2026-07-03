package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleWorkspaceByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext) {
	path := strings.Trim(strings.TrimPrefix(r.URL.Path, "/workspaces/"), "/")
	parts := strings.Split(path, "/")
	if len(parts) == 3 && parts[1] == "members" {
		a.handleWorkspaceMembershipByIDMySQL(w, r, auth, parts[0], parts[2])
		return
	}
	if len(parts) != 1 || parts[0] == "" {
		writeError(w, http.StatusBadRequest, "workspace id is required")
		return
	}
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	workspaceID := parts[0]
	var req workspaceUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	name := strings.TrimSpace(req.Name)
	if name == "" {
		writeError(w, http.StatusBadRequest, "workspace name is required")
		return
	}
	workspaceType := strings.TrimSpace(req.Type)
	if workspaceType != "" && workspaceType != "private" && workspaceType != "shared" {
		writeError(w, http.StatusBadRequest, "workspace type must be private or shared")
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
	workspace, failure := updateWorkspaceInTx(ctx, tx, auth, workspaceUpdateInput{
		workspaceID: workspaceID,
		name:        name,
		kind:        workspaceType,
		ownerID:     req.OwnerAccountID,
	})
	if writeMemberFailure(w, failure) {
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"workspace": publicWorkspace(workspace)})
}
