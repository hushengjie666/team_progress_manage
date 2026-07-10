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
	var req invitationActionRequest
	if err := decodeJSON(w, r, &req); err != nil || req.ExpectedRevision <= 0 {
		writeError(w, http.StatusPreconditionRequired, "expected revision is required")
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
	if failure := acceptProjectInvitationInTx(ctx, tx, auth, invitationID, req.ExpectedRevision); writeMemberFailure(w, failure) {
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
	var req invitationActionRequest
	if err := decodeJSON(w, r, &req); err != nil || req.ExpectedRevision <= 0 {
		writeError(w, http.StatusPreconditionRequired, "expected revision is required")
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
	if invitation.Revision != req.ExpectedRevision {
		writeError(w, http.StatusConflict, "revision_conflict")
		return
	}
	now := time.Now().UTC().Format(time.RFC3339)
	result, err := tx.ExecContext(
		ctx,
		`UPDATE project_invitations SET status = 'cancelled', updated_at = ?, row_version = row_version + 1 WHERE id = ? AND status = 'pending' AND row_version = ?`,
		now,
		invitation.ID,
		req.ExpectedRevision,
	)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "save failed")
		return
	}
	if count, err := result.RowsAffected(); err != nil || count != 1 {
		writeError(w, http.StatusConflict, "revision_conflict")
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
