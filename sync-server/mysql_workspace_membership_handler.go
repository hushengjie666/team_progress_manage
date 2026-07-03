package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleWorkspaceMembershipByIDMySQL(w http.ResponseWriter, r *http.Request, auth authContext, workspaceID string, membershipID string) {
	if r.Method != http.MethodPatch {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	if workspaceID == "" || membershipID == "" {
		writeError(w, http.StatusBadRequest, "workspace member id is required")
		return
	}
	var req workspaceMembershipUpdateRequest
	if err := decodeJSON(w, r, &req); err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	status := strings.TrimSpace(req.Status)
	if status != "active" && status != "disabled" {
		writeError(w, http.StatusBadRequest, "workspace member status must be active or disabled")
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

	workspace, foundWorkspace, err := mysqlWorkspaceVisibleToAccount(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace failed")
		return
	}
	if !foundWorkspace {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	currentMembership, foundCurrentMembership, err := mysqlActiveMembershipByAccountAndWorkspace(ctx, tx, auth.AccountID, workspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundCurrentMembership || (currentMembership.Role != "owner" && currentMembership.Role != "admin") {
		writeError(w, http.StatusForbidden, "workspace access denied")
		return
	}
	targetMembership, foundTargetMembership, err := mysqlWorkspaceMembershipSummaryByID(ctx, tx, workspaceID, membershipID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundTargetMembership {
		writeError(w, http.StatusNotFound, "workspace member not found")
		return
	}
	if status == "disabled" {
		if targetMembership.AccountID == auth.AccountID {
			writeError(w, http.StatusBadRequest, "cannot remove current account from workspace")
			return
		}
		if targetMembership.Role == "owner" || targetMembership.AccountID == workspace.OwnerAccountID {
			writeError(w, http.StatusBadRequest, "workspace owner cannot be removed")
			return
		}
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships SET status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
		status,
		now,
		workspaceID,
		membershipID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, workspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	updatedMembership, foundUpdatedMembership, err := mysqlWorkspaceMembershipSummaryByID(ctx, a.db, workspaceID, membershipID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace membership failed")
		return
	}
	if !foundUpdatedMembership {
		writeError(w, http.StatusNotFound, "workspace member not found")
		return
	}
	writeJSON(w, http.StatusOK, workspaceMembershipResponse{Membership: updatedMembership})
}
