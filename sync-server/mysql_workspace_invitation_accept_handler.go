package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleWorkspaceInvitationByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "workspace invitations require mysql backend")
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	actionPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/workspace-invitations/"), "/")
	if r.Method == http.MethodDelete {
		if strings.TrimSpace(actionPath) == "" || strings.Contains(actionPath, "/") {
			writeError(w, http.StatusBadRequest, "unsupported invitation action")
			return
		}
		a.cancelWorkspaceInvitation(w, r, auth, actionPath)
		return
	}
	invitationID := strings.TrimSuffix(actionPath, "/accept")
	if invitationID == actionPath || strings.TrimSpace(invitationID) == "" {
		writeError(w, http.StatusBadRequest, "unsupported invitation action")
		return
	}
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	invitation, found, err := mysqlWorkspaceInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "workspace invitation not found")
		return
	}
	if invitation.InviteeAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "workspace invitation access denied")
		return
	}
	if invitation.Status != "pending" {
		writeError(w, http.StatusConflict, "workspace invitation is not pending")
		return
	}
	account, foundAccount, err := mysqlAccountByID(ctx, tx, auth.AccountID)
	if err != nil || !foundAccount || account.DisabledAt != "" {
		writeError(w, http.StatusUnauthorized, "account not found")
		return
	}
	workspace, foundWorkspace, err := mysqlWorkspaceByID(ctx, tx, invitation.WorkspaceID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !foundWorkspace || workspace.Type == "private" {
		writeError(w, http.StatusNotFound, "workspace not found")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if err := mysqlEnsureWorkspaceMembership(ctx, tx, invitation.WorkspaceID, auth.AccountID, "member", "active", now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_invitations SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ?`,
		now,
		now,
		invitation.ID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := mysqlTouchWorkspace(ctx, tx, invitation.WorkspaceID, now); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	accepted, _, err := mysqlWorkspaceInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": accepted})
}

func (a *app) cancelWorkspaceInvitation(w http.ResponseWriter, r *http.Request, auth authContext, invitationID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	invitation, found, err := mysqlWorkspaceInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "workspace invitation not found")
		return
	}
	if invitation.InviteeAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "workspace invitation access denied")
		return
	}
	if invitation.Status != "pending" {
		writeError(w, http.StatusConflict, "workspace invitation is not pending")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE workspace_invitations SET status = 'cancelled', updated_at = ? WHERE id = ?`,
		now,
		invitation.ID,
	); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	cancelled, _, err := mysqlWorkspaceInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load workspace invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": cancelled})
}
