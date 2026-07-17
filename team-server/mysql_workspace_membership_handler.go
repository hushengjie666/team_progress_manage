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
	role := strings.TrimSpace(req.Role)
	if status != "" && !isWorkspaceMembershipStatus(status) {
		writeError(w, http.StatusBadRequest, "workspace member status must be active or disabled")
		return
	}
	if role != "" && !isWorkspaceMembershipRole(role) {
		writeError(w, http.StatusBadRequest, "workspace member role must be owner, admin, or member")
		return
	}
	if status == "" && role == "" {
		writeError(w, http.StatusBadRequest, "workspace member status or role is required")
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
	nextStatus := targetMembership.Status
	if status != "" {
		nextStatus = status
	}
	nextRole := targetMembership.Role
	if role != "" {
		nextRole = role
	}
	if status == "disabled" {
		if targetMembership.AccountID == auth.AccountID {
			writeError(w, http.StatusBadRequest, "cannot remove current account from workspace")
			return
		}
		if targetMembership.AccountID == workspace.OwnerAccountID {
			writeError(w, http.StatusBadRequest, "workspace creator cannot be removed")
			return
		}
		if targetMembership.Role == "owner" {
			writeError(w, http.StatusBadRequest, "workspace owner cannot be removed")
			return
		}
	}
	if role != "" && workspace.Type == "private" {
		writeError(w, http.StatusBadRequest, "private workspace member role cannot be changed")
		return
	}
	if role != "" && targetMembership.Role == "owner" && nextRole != "owner" && targetMembership.Status == "active" {
		ownerCount, err := mysqlActiveWorkspaceOwnerCount(ctx, tx, workspaceID)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "load workspace membership failed")
			return
		}
		if ownerCount <= 1 {
			writeError(w, http.StatusBadRequest, "workspace must keep at least one active owner")
			return
		}
	}
	if nextRole == "owner" && nextStatus != "active" {
		writeError(w, http.StatusBadRequest, "workspace owner must be active")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_memberships SET role = ?, status = ?, updated_at = ? WHERE workspace_id = ? AND id = ?`,
		nextRole,
		nextStatus,
		now,
		workspaceID,
		membershipID,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		writeError(w, http.StatusNotFound, "workspace member not found")
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

func mysqlActiveWorkspaceOwnerCount(ctx context.Context, q sqlRunner, workspaceID string) (int, error) {
	var count int
	err := q.QueryRowContext(
		ctx,
		`SELECT COUNT(*) FROM workspace_memberships WHERE workspace_id = ? AND role = 'owner' AND status = 'active'`,
		workspaceID,
	).Scan(&count)
	return count, err
}
