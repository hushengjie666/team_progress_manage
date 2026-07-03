package main

import (
	"context"
	"net/http"
	"strings"
	"time"
)

func (a *app) handleProjectInvitationByID(w http.ResponseWriter, r *http.Request, auth authContext) {
	if a.db == nil {
		writeError(w, http.StatusNotImplemented, "project invitations require mysql backend")
		return
	}
	if r.Method != http.MethodPost && r.Method != http.MethodDelete {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}
	actionPath := strings.Trim(strings.TrimPrefix(r.URL.Path, "/project-invitations/"), "/")
	if r.Method == http.MethodDelete {
		if strings.TrimSpace(actionPath) == "" || strings.Contains(actionPath, "/") {
			writeError(w, http.StatusBadRequest, "unsupported invitation action")
			return
		}
		a.cancelProjectInvitation(w, r, auth, actionPath)
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
	if failure := acceptProjectInvitationInTx(ctx, tx, auth, invitationID); writeMemberFailure(w, failure) {
		return
	}
	if err := tx.Commit(); err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	accepted, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": accepted})
}

func (a *app) cancelProjectInvitation(w http.ResponseWriter, r *http.Request, auth authContext, invitationID string) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	tx, err := a.db.BeginTx(ctx, nil)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	defer mysqlRollback(tx)
	invitation, found, err := mysqlProjectInvitationSummaryByID(ctx, tx, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if !found {
		writeError(w, http.StatusNotFound, "project invitation not found")
		return
	}
	if invitation.InviteeAccountID != auth.AccountID {
		writeError(w, http.StatusForbidden, "project invitation access denied")
		return
	}
	if invitation.Status != "pending" {
		writeError(w, http.StatusConflict, "project invitation is not pending")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	if _, err := tx.ExecContext(
		ctx,
		`UPDATE project_invitations SET status = 'cancelled', updated_at = ? WHERE id = ?`,
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
	cancelled, _, err := mysqlProjectInvitationSummaryByID(ctx, a.db, invitationID)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "load project invitation failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"invitation": cancelled})
}
