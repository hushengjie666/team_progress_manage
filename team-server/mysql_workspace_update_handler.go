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
	if len(parts) == 2 && parts[1] == "restriction-impact" {
		a.handleWorkspaceRestrictionImpact(w, r, auth, parts[0])
		return
	}
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
	if !isWorkspaceType(workspaceType) {
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
		workspaceID:            workspaceID,
		name:                   name,
		kind:                   workspaceType,
		ownerID:                req.OwnerAccountID,
		confirmRestrictMembers: req.ConfirmRestrictMembers,
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

func (a *app) handleWorkspaceRestrictionImpact(w http.ResponseWriter, r *http.Request, auth authContext, workspaceID string) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 5*time.Second)
	defer cancel()
	allowed, err := teamAccountCanManageWorkspace(ctx, a.db, auth, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if !allowed {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	workspace, found, err := mysqlWorkspaceByID(ctx, a.db, workspaceID)
	if err != nil || !found {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	var members int
	var invitations int
	if err := a.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND account_id <> ? AND status = 'active'`, workspaceID, workspace.OwnerAccountID).Scan(&members); err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if err := a.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM workspace_invitations WHERE workspace_id = ? AND status = 'pending'`, workspaceID).Scan(&invitations); err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]int{"active_members": members, "pending_invitations": invitations})
}
